# ---------- Build stage (JDK 17 + Maven)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY purchase-order-service/pom.xml .
RUN mvn -B -q dependency:go-offline

# Copy shared proto definitions into the standard protobuf-maven-plugin location
COPY proto ./src/main/proto

COPY purchase-order-service/src ./src
RUN mvn -B -q package -DskipTests

# ---------- Runtime stage (JRE 17 only)
FROM eclipse-temurin:17-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 1001 spendwise
WORKDIR /app
COPY --from=build /build/target/purchase-order-service.jar app.jar
USER spendwise
EXPOSE 8082
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
