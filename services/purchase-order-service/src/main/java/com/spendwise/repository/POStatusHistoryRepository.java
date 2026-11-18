package com.spendwise.repository;

import com.spendwise.entity.POStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface POStatusHistoryRepository extends JpaRepository<POStatusHistory, Long> {
    List<POStatusHistory> findByPoIdOrderByChangedAtAsc(Long poId);
}
