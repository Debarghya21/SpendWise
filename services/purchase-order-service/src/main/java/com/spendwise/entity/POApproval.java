package com.spendwise.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "po_approvals")
@Getter
@Setter
@NoArgsConstructor
public class POApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "po_id", nullable = false)
    private Long poId;

    @Column(name = "approver_id", nullable = false, length = 100)
    private String approverId;

    @Column(nullable = false, length = 20)
    private String decision;

    @Column(length = 500)
    private String comment;

    @Column(name = "decided_at", nullable = false)
    private Instant decidedAt = Instant.now();

    public POApproval(Long poId, String approverId, String decision, String comment) {
        this.poId = poId;
        this.approverId = approverId;
        this.decision = decision;
        this.comment = comment;
    }
}
