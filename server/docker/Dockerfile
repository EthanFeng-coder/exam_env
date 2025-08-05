FROM mcr.microsoft.com/dotnet/sdk:8.0-jammy

WORKDIR /app
COPY run.sh .

# Fix script permissions and format
RUN chmod +x /app/run.sh && \
    apt-get update && \
    apt-get install -y dos2unix && \
    dos2unix /app/run.sh && \
    apt-get remove -y dos2unix && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

CMD ["/bin/bash", "/app/run.sh"]