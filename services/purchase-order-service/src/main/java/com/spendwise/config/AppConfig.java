package com.spendwise.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
public class AppConfig {

    private ManagedChannel supplierChannel;
    private ManagedChannel budgetChannel;

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

    /** gRPC channel to the Supplier Service. */
    @Bean(name = "supplierChannel")
    public ManagedChannel supplierChannel(
            @Value("${spendwise.grpc.supplier-target}") String target) {
        supplierChannel = ManagedChannelBuilder.forTarget(target)
                .usePlaintext()          // internal Docker/K8s network — no TLS
                .defaultLoadBalancingPolicy("round_robin")
                .build();
        return supplierChannel;
    }

    /** gRPC channel to the Budget Service. */
    @Bean(name = "budgetChannel")
    public ManagedChannel budgetChannel(
            @Value("${spendwise.grpc.budget-target}") String target) {
        budgetChannel = ManagedChannelBuilder.forTarget(target)
                .usePlaintext()          // internal Docker/K8s network — no TLS
                .defaultLoadBalancingPolicy("round_robin")
                .build();
        return budgetChannel;
    }

    @PreDestroy
    public void shutdownChannels() {
        shutdownChannel(supplierChannel, "supplier");
        shutdownChannel(budgetChannel, "budget");
    }

    private void shutdownChannel(ManagedChannel channel, String name) {
        if (channel != null && !channel.isShutdown()) {
            channel.shutdown();
            try {
                if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                channel.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
