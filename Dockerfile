# Build the Spring Boot backend with Java 21
FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace/backend

COPY backend/ ./
RUN chmod +x ./mvnw && ./mvnw -B -DskipTests package

# Run with a smaller Java 21 runtime image
FROM eclipse-temurin:21-jre-jammy AS runtime

WORKDIR /app

RUN useradd --system --uid 10001 --create-home appuser

COPY --from=build --chown=appuser:appuser /workspace/backend/target/*.jar /app/app.jar

USER appuser

EXPOSE 8080

ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k -XX:MaxMetaspaceSize=128m"
ENV SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3
ENV SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1

# Render supplies PORT. Spring Boot receives it as server.port.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_TOOL_OPTIONS -jar /app/app.jar --server.port=${PORT:-8080}"]
