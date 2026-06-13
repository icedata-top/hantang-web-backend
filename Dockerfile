FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /workspace/target/hantang-web-backend-1.0-SNAPSHOT.jar /app/app.jar

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "test -f /app/config.secret.properties || { echo 'Missing /app/config.secret.properties. Mount the runtime DB config file into /app/config.secret.properties.' >&2; exit 1; }; exec java -jar /app/app.jar"]
