FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY pom.xml ./
COPY src ./src

RUN mvn clean -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

ENV PORT=8080
ENV DATA_DIR=/app/server-data

COPY --from=build /app/target/finchi-webgame-*.jar /app/finchi-webgame.jar

RUN mkdir -p /app/server-data

EXPOSE 8080

CMD ["java", "-jar", "/app/finchi-webgame.jar"]
