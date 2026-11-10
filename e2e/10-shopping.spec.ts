import { admin, expectMobileLayout, login } from './helpers'
import { expect, test } from './test'

test.describe.configure({ mode: 'serial' })
test.use({ actionTimeout: 10_000 })
let firstRunPath = ''

test('boodschappen voor een gerecht schalen en kopiëren met een bewaarde lijst en exporthistorie', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Reflect.set(window, '__copiedShoppingText', text)
        },
      },
    }),
  )
  await login(page, admin.email)
  await page.goto('/gerechten')
  await page.getByRole('link', { name: /Tomatensoep na bereiding/ }).click()
  const persons = page.getByRole('group', { name: 'Personen' })
  await expect(persons.getByRole('status')).toHaveText('2')
  await persons.getByRole('button', { name: 'Meer personen' }).click()
  await persons.getByRole('button', { name: 'Meer personen' }).click()
  await expect(persons.getByRole('status')).toHaveText('4')
  await page.getByRole('link', { name: 'Op lijst zetten' }).click()
  const toBuy = page.getByRole('region', { name: 'Te kopen' })
  await expect(toBuy).toContainText('100 g te kopen')
  const keep = toBuy.getByRole('checkbox', { name: 'Tomaten in blokjes op de lijst zetten', exact: true })
  await expect(keep).toBeChecked()
  await keep.uncheck()
  await expect(toBuy).toContainText('Al in huis · gaat niet mee')
  await expect(page.getByText(/· 1 al in huis$/)).toBeVisible()
  await expectMobileLayout(page)
  await keep.check()
  await expect(toBuy).not.toContainText('Al in huis')
  await expect(page.getByRole('button', { name: /^Notion/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Delen/ })).toHaveAttribute('aria-pressed', 'true')
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
  await expect(page.getByLabel('Boodschappenlijst')).toContainText('100 g · Tomaten in blokjes')
  firstRunPath = new URL(page.url()).pathname
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Kopiëren', exact: true }).click()
  await expect(page.getByText('Gekopieerd', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, '__copiedShoppingText'))).toContain(
    '100 g · Tomaten in blokjes',
  )
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: testInfo.outputPath('shopping-dark.png'), fullPage: true })
  await page.getByRole('link', { name: 'Terug naar exporthistorie' }).click()
  await expect(page.getByRole('link', { name: /Tomatensoep na bereiding/ })).toHaveCount(1)
  await expectMobileLayout(page)
})

test('dag/weekoverlap, annulering van het deelmenu en handmatige tekstfallback werken zonder stille duplicaten', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Geannuleerd', 'AbortError')
      },
    })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    document.execCommand = () => false
  })
  await login(page, admin.email)
  await page.goto('/voorraad/nieuw')
  await page.getByLabel('Ingrediënt zoeken').fill('tomaat in blik')
  await page.getByRole('button', { name: 'Zoek ingrediënt', exact: true }).click()
  await page.getByRole('button', { name: 'Tomaten in blokjes', exact: true }).click()
  await page.getByLabel('Hoeveelheid (g)', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Voorraad opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tomaten in blokjes', level: 1 })).toBeVisible()
  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Maaltijd plannen', exact: true }).click()
  await page.getByLabel('Gerecht zoeken').fill('Tomatensoep na bereiding')
  await page.getByRole('button', { name: /^Tomatensoep na bereiding/ }).click()
  await page.getByRole('button', { name: 'Maaltijd opslaan', exact: true }).click()
  await expect(page).toHaveURL(/\/week\?week=2027-01-05$/)
  await page.goto('/week/dag/2027-01-05')
  await page.getByRole('link', { name: 'Op lijst zetten', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Te kopen' })).toContainText('300 g te kopen')
  await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
  await page.getByRole('button', { name: 'Delen via mijn apparaat' }).click()
  await expect(page.getByText('Geannuleerd', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Nieuw voorstel voor deze bron' }).click()
  await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
  await page.getByRole('button', { name: 'Kopiëren', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('De tekst is geselecteerd')
  expect(
    await page
      .getByLabel('Boodschappenlijst')
      .evaluate(
        (node: HTMLTextAreaElement) => node.selectionStart === 0 && node.selectionEnd === node.value.length,
      ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Ik heb de tekst zelf gekopieerd' }).click()
  await expect(page.getByText('Gekopieerd', { exact: true })).toBeVisible()
  await page.goto('/week?week=2027-01-04')
  await page.getByRole('link', { name: 'Boodschappen voor deze week' }).click()
  await expect(page.getByRole('region', { name: 'Te kopen' })).toContainText('300 g te kopen')
  await expect(page.getByRole('region', { name: 'Niet meegerekend' })).toContainText(
    'Tomatensoep na bereiding · al gemaakt',
  )
  await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('al naar dit doel geëxporteerd')
  await page.getByRole('checkbox', { name: 'Bewust opnieuw exporteren naar dit doel' }).check()
  await page.getByRole('button', { name: 'Zet op lijst · Delen', exact: true }).click()
  await page.getByRole('button', { name: 'Deelverzoek annuleren' }).click()
  await expect(page.getByText('Geannuleerd', { exact: true })).toBeVisible()
})

test('eigenaar kan Notion instellen zonder geheim terug te tonen en de verbinding weer verwijderen', async ({
  page,
}) => {
  const token = 'ntn_fictief_e2e_token_wordt_niet_naar_Notion_verzonden'
  await login(page, admin.email)
  await page.goto('/meer/boodschappen/verbindingen')
  await page.getByLabel('Notion-pagina-ID').fill('8c04dfde-d49f-4d28-baa1-aa37d8884f55')
  await page.getByLabel('Notion-token', { exact: true }).fill(token)
  await expectMobileLayout(page)
  await page.getByRole('button', { name: 'Notion-verbinding opslaan' }).click()
  await expect(
    page.getByText('Notion-verbinding opgeslagen. Er is nog geen lijst verzonden.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Notion-token', { exact: true })).toHaveValue('')
  expect(await page.content()).not.toContain(token)
  await page.reload()
  await expect(page.getByLabel('Notion-token', { exact: true })).toHaveValue('')
  await expect(
    page.getByText('Verbinding ingesteld voor pagina 8c04dfde-d49f-4d28-baa1-aa37d8884f55.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Notion-verbinding verwijderen' }).click()
  await expect(page.getByText('Nog geen Notion-verbinding ingesteld.', { exact: true })).toBeVisible()
})

test('gewone leden beheren geen verbindingen en andere huishoudens zien geen export-ID of inhoud', async ({
  page,
}) => {
  await login(page, 'tim@e2e.test', 'nieuw-wachtwoord-123')
  await page.goto('/meer/boodschappen/verbindingen')
  await expect(page.getByRole('button', { name: 'Notion-verbinding opslaan' })).toHaveCount(0)
  await expect(
    page.getByText('Vraag een eigenaar van dit huishouden om de verbinding in te stellen.', { exact: true }),
  ).toBeVisible()
  await page.goto(firstRunPath)
  await expect(page.getByRole('alert')).toHaveText('Boodschappenexport niet gevonden.')
  await page.goto('/meer/boodschappen/historie')
  await expect(page.getByRole('link', { name: /Tomatensoep/ })).toHaveCount(0)
})
