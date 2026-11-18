package com.spendwise.repository;

import com.spendwise.entity.POApproval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface POApprovalRepository extends JpaRepository<POApproval, Long> {
    List<POApproval> findByPoIdOrderByDecidedAtAsc(Long poId);
}
