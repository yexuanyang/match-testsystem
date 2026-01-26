FROM python:3.10-slim

WORKDIR /app

# 安装 Docker CLI (为了让 Worker 也可以(如果需要)执行 docker 命令，虽然主要用 docker sdk)
# 以及编译依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    ca-certificates \
    docker.io \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Docker client (optional but useful for debugging inside container)
# ENV DOCKER_VERSION=20.10.9
# RUN curl -sfL -o docker.tgz "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" && \
#   tar -xzf docker.tgz --strip 1 -C /usr/local/bin docker/docker && \
#   rm docker.tgz

COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
