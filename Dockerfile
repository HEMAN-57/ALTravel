# Multi-stage Dockerfile for TripSync Spring Boot Backend
# Target: Java 21 on Render Web Service (Free Tier: 512 MB RAM, 0.1 CPU)

# ==============================================================================
# Stage 1: Build JAR using Eclipse Temurin JDK 21 & Maven Wrapper
# ==============================================================================
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /workspace

# Copy Maven wrapper configuration and project descriptor for layer caching
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline -B

# Copy backend source code and compile production JAR
COPY backend/src/ src/
RUN ./mvnw clean package -DskipTests -B

# ==============================================================================
# Stage 2: Minimal Production JRE Runtime
# ==============================================================================
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Run as non-privileged system user
RUN groupadd -r tripsync && useradd -r -g tripsync tripsync
USER tripsync:tripsync

# Copy built application JAR
COPY --from=builder --chown=tripsync:tripsync /workspace/target/altravel-backend-0.1.0-SNAPSHOT.jar app.jar

# Conservative JVM memory parameters for Render 512MB RAM / 0.1 CPU limit:
# - UseContainerSupport: Detects cgroup memory limit automatically
# - MaxRAMPercentage=50.0: Limits maximum heap to 256MB in a 512MB container
# - UseSerialGC: Eliminates G1 multi-threaded GC overhead and native memory structures
# - TieredStopAtLevel=1: Restricts JIT to C1 client compiler, preventing C2 spikes on 0.1 CPU
# - Xss512k: Halves per-thread stack allocation (default is 1024k)
# - MaxMetaspaceSize=128m: Bounds Metaspace class metadata allocation
ENV PORT=8080 \
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3 \
    SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1 \
    JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=50.0 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k -XX:MaxMetaspaceSize=128m -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java -Dserver.port=${PORT:-8080} -jar app.jar"]
