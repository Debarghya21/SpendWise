package com.spendwise.messaging;

import com.spendwise.entity.OutboxEvent;
import com.spendwise.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

/**
 * Background relay of the transactional outbox to RabbitMQ.
 * Messages are persistent and published with publisher confirms; an event is marked
 * published only after the broker confirms it. If RabbitMQ is down, events stay in the
 * outbox and are retried on the next poll (at-least-once; consumers are idempotent).
 */
@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);

    private final OutboxEventRepository outboxRepository;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;

    public OutboxPublisher(OutboxEventRepository outboxRepository, RabbitTemplate rabbitTemplate,
                           @Value("${spendwise.messaging.exchange}") String exchange) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
    }

    @Scheduled(fixedDelayString = "${spendwise.outbox.poll-interval-ms:2000}", initialDelay = 5000)
    @Transactional
    public void publishPending() {
        List<OutboxEvent> batch = outboxRepository.findTop50ByPublishedAtIsNullOrderByCreatedAtAsc();
        for (OutboxEvent event : batch) {
            try {
                MessageProperties props = new MessageProperties();
                props.setContentType(MessageProperties.CONTENT_TYPE_JSON);
                props.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                props.setMessageId(event.getId());
                props.setType(event.getEventType());
                Message message = new Message(event.getPayload().getBytes(StandardCharsets.UTF_8), props);

                rabbitTemplate.invoke(ops -> {
                    ops.send(exchange, event.getRoutingKey(), message);
                    ops.waitForConfirmsOrDie(5000);
                    return null;
                });
                event.setPublishedAt(Instant.now());
                log.info("Published {} for {} ({})", event.getEventType(), event.getAggregateId(), event.getId());
            } catch (AmqpException | IllegalStateException e) {
                event.setAttempts(event.getAttempts() + 1);
                log.warn("RabbitMQ unavailable, event {} stays in outbox (attempt {}): {}",
                        event.getId(), event.getAttempts(), e.getMessage());
                break; // keep ordering; retry on next poll
            }
        }
    }
}
