pub(crate) fn current_timestamp_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

pub(crate) fn scoped_id(prefix: &str, timestamp: i64, index: usize) -> String {
    format!("{prefix}_{timestamp}_{index}")
}

pub(crate) fn calculate_included_tax(total: i64, tax_rate_bps: i64) -> i64 {
    if total <= 0 || tax_rate_bps <= 0 {
        return 0;
    }

    (total * tax_rate_bps + 5_000) / (10_000 + tax_rate_bps)
}
