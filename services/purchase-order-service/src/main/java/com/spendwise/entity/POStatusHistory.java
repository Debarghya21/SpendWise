package com.spendwise.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "po_status_history", indexes = @Index(name = "idx_history_po", columnList = "po_id"))
@Getter
@Setter
@NoArgsConstructor
public class POStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "po_id", nullable = false)
    private Long poId;

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status", length = 30)
    private POStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 30)
    private POStatus newStatus;

    @Column(length = 500)
    private String reason;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt = Instant.now();

    public POStatusHistory(Long poId, POStatus oldStatus, POStatus newStatus, String reason) {
        this.poId = poId;
        this.oldStatus = oldStatus;
        this.newStatus = newStatus;
        this.reason = reason;
    }
}
