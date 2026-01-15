FROM python:3.9-slim

ENV http_proxy=http://172.17.0.1:7897
ENV https_proxy=http://172.17.0.1:7897
RUN apt-get update && apt-get install unzip

CMD ["/bin/bash"]
