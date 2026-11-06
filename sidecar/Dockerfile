FROM ghcr.io/astral-sh/uv:0.8.17 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY gerechter_ah ./gerechter_ah
RUN groupadd -g 1000 ah && useradd -u 1000 -g ah -m ah && mkdir /data && chown ah:ah /data
USER ah
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD /app/.venv/bin/python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2)"
CMD ["/app/.venv/bin/uvicorn", "gerechter_ah.service:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
