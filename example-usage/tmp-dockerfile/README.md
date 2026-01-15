# 构建
docker build . -t test-lab:latest -f ./Dockerfile

# 解释
这个镜像在python:3.9-slim基础上仅仅增加了一个unzip包，用于解压用户提交的zip文件。这个镜像仅仅用作测试系统的基本测试流程。
