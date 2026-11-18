package com.spendwise.config;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

@Configuration
public class AppConfig {

    /** Durable topic exchange shared by all SpendWise producers/consumers. */
    @Bean
    public TopicExchange spendwiseExchange(@Value("${spendwise.messaging.exchange}") String name) {
        return new TopicExchange(name, true, false);
    }

    /** Short timeouts so a slow/unavailable dependency fails fast (feeds the circuit breaker). */
    @Bean
    public SimpleClientHttpRequestFactory httpRequestFactory(
            @Value("${spendwise.http.connect-timeout-ms}") long connectTimeout,
            @Value("${spendwise.http.read-timeout-ms}") long readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(connectTimeout));
        factory.setReadTimeout(Duration.ofMillis(readTimeout));
        return factory;
    }
}
