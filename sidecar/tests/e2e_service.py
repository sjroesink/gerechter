"""Real ASGI service with the real Appie client and an isolated HTTP fixture.

Only imported by Playwright's test process; never included in the runtime image.
"""

import tempfile
from pathlib import Path

from gerechter_ah.service import Settings, create_app
from tests.conftest import SECRET, Backend


def create_test_app():
    directory = tempfile.TemporaryDirectory(prefix="gerechter-ah-e2e-")
    backend = Backend()
    app = create_app(Settings(SECRET, Path(directory.name) / "appie.sqlite"), backend.transport)
    # Keep the temporary directory alive until the test server exits.
    app.state.test_directory = directory
    return app
