-- =============================================
-- Posh Notification System - Database Schema
-- PostgreSQL 15+
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS (Platform users / site owners)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (
        role IN (
            'user',
            'admin',
            'super_admin'
        )
    ),
    plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (
        plan IN (
            'free',
            'starter',
            'pro',
            'enterprise'
        )
    ),
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

CREATE INDEX idx_users_role ON users (role);

-- =============================================
-- SITES (Websites managed by users)
-- =============================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL DEFAULT encode (gen_random_bytes (32), 'hex'),
    api_secret VARCHAR(64) UNIQUE NOT NULL DEFAULT encode (gen_random_bytes (32), 'hex'),
    vapid_public_key TEXT,
    vapid_private_key TEXT,
    fcm_server_key TEXT,
    fcm_project_id VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}',
    widget_config JSONB NOT NULL DEFAULT '{
        "buttonStyle": {
            "color": "#4F46E5",
            "size": "medium",
            "position": "bottom-right"
        },
        "promptType": "bell",
        "triggerRules": {
            "type": "delay",
            "value": 5
        },
        "language": "en",
        "consentBanner": {
            "enabled": true,
            "text": "We would like to send you push notifications. You can unsubscribe at any time."
        }
    }',
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_user_id ON sites (user_id);

CREATE INDEX idx_sites_api_key ON sites (api_key);

CREATE INDEX idx_sites_domain ON sites (domain);

-- =============================================
-- SUBSCRIBERS
-- =============================================
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT,
    auth_key TEXT,
    fcm_token TEXT,
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    os_version VARCHAR(20),
    device_type VARCHAR(20) DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    country VARCHAR(3),
    city VARCHAR(100),
    ip_address INET,
    timezone VARCHAR(50),
    language VARCHAR(10),
    tags TEXT[] DEFAULT '{}',
    custom_data JSONB DEFAULT '{}',
    consent_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'denied', 'revoked')),
    consent_timestamp TIMESTAMPTZ,
    consent_ip INET,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, endpoint)
);

CREATE INDEX idx_subscribers_site_id ON subscribers (site_id);

CREATE INDEX idx_subscribers_tags ON subscribers USING GIN (tags);

CREATE INDEX idx_subscribers_country ON subscribers (country);

CREATE INDEX idx_subscribers_device_type ON subscribers (device_type);

CREATE INDEX idx_subscribers_consent ON subscribers (consent_status);

CREATE INDEX idx_subscribers_active ON subscribers (is_active)
WHERE
    is_active = true;

CREATE INDEX idx_subscribers_custom_data ON subscribers USING GIN (custom_data);

-- =============================================
-- SEGMENTS (Audience groups)
-- =============================================
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rules JSONB NOT NULL DEFAULT '[]',
    is_auto BOOLEAN NOT NULL DEFAULT false,
    subscriber_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_site_id ON segments (site_id);

-- =============================================
-- SEGMENT SUBSCRIBERS (Many-to-many)
-- =============================================
CREATE TABLE segment_subscribers (
    segment_id UUID NOT NULL REFERENCES segments (id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (segment_id, subscriber_id)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    icon_url VARCHAR(500),
    image_url VARCHAR(500),
    badge_url VARCHAR(500),
    click_action VARCHAR(500),
    deep_link JSONB,
    data JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'scheduled',
            'sending',
            'sent',
            'cancelled',
            'failed'
        )
    ),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    target_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (
        target_type IN (
            'all',
            'segment',
            'tags',
            'filter',
            'individual'
        )
    ),
    target_config JSONB DEFAULT '{}',
    timezone_aware BOOLEAN NOT NULL DEFAULT false,
    ttl INT DEFAULT 86400,
    urgency VARCHAR(10) DEFAULT 'normal' CHECK (
        urgency IN (
            'very-low',
            'low',
            'normal',
            'high'
        )
    ),
    ab_test_id UUID,
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_clicked INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_site_id ON notifications (site_id);

CREATE INDEX idx_notifications_status ON notifications (status);

CREATE INDEX idx_notifications_scheduled ON notifications (scheduled_at)
WHERE
    status = 'scheduled';

-- =============================================
-- NOTIFICATION DELIVERIES (Per-subscriber tracking)
-- =============================================
CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    notification_id UUID NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'sent',
            'delivered',
            'clicked',
            'failed',
            'expired'
        )
    ),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    failed_reason TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_notification ON notification_deliveries (notification_id);

CREATE INDEX idx_deliveries_subscriber ON notification_deliveries (subscriber_id);

CREATE INDEX idx_deliveries_status ON notification_deliveries (status);

-- =============================================
-- AB TESTS
-- =============================================
CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'running',
            'completed',
            'cancelled'
        )
    ),
    variant_a_id UUID REFERENCES notifications (id),
    variant_b_id UUID REFERENCES notifications (id),
    split_percentage INT NOT NULL DEFAULT 50 CHECK (
        split_percentage BETWEEN 10 AND 90
    ),
    winner_metric VARCHAR(20) NOT NULL DEFAULT 'ctr' CHECK (
        winner_metric IN ('ctr', 'delivered', 'clicked')
    ),
    winner_variant VARCHAR(1),
    sample_size INT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_site_id ON ab_tests (site_id);

-- =============================================
-- AUTOMATIONS
-- =============================================
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (
        type IN (
            'welcome',
            'new_post',
            'scheduled',
            'drip',
            'event_triggered'
        )
    ),
    is_active BOOLEAN NOT NULL DEFAULT true,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    notification_template JSONB NOT NULL DEFAULT '{}',
    target_config JSONB DEFAULT '{}',
    delay_seconds INT DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    total_triggered INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automations_site_id ON automations (site_id);

CREATE INDEX idx_automations_type ON automations(type);

CREATE INDEX idx_automations_active ON automations (is_active)
WHERE
    is_active = true;

-- =============================================
-- DRIP CAMPAIGN STEPS
-- =============================================
CREATE TABLE drip_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    automation_id UUID NOT NULL REFERENCES automations (id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    delay_seconds INT NOT NULL DEFAULT 0,
    notification_template JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drip_steps_automation ON drip_steps (automation_id);

-- =============================================
-- DRIP ENROLLMENTS (Subscriber in a drip)
-- =============================================
CREATE TABLE drip_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    automation_id UUID NOT NULL REFERENCES automations (id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES subscribers (id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (
        status IN (
            'active',
            'completed',
            'paused',
            'cancelled'
        )
    ),
    next_step_at TIMESTAMPTZ,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (automation_id, subscriber_id)
);

CREATE INDEX idx_drip_enrollments_next ON drip_enrollments (next_step_at)
WHERE
    status = 'active';

-- =============================================
-- EVENTS (Subscriber activity tracking)
-- =============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers (id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    page_url VARCHAR(500),
    referrer VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_site_id ON events (site_id);

CREATE INDEX idx_events_subscriber ON events (subscriber_id);

CREATE INDEX idx_events_type ON events (event_type);

CREATE INDEX idx_events_created ON events (created_at);

-- Partition events by month for performance
-- CREATE TABLE events_y2025m01 PARTITION OF events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- =============================================
-- ANALYTICS (Daily aggregates)
-- =============================================
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_subscribers INT NOT NULL DEFAULT 0,
    new_subscribers INT NOT NULL DEFAULT 0,
    unsubscribed INT NOT NULL DEFAULT 0,
    notifications_sent INT NOT NULL DEFAULT 0,
    notifications_delivered INT NOT NULL DEFAULT 0,
    notifications_clicked INT NOT NULL DEFAULT 0,
    notifications_failed INT NOT NULL DEFAULT 0,
    ctr DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, date)
);

CREATE INDEX idx_analytics_site_date ON analytics_daily (site_id, date);

-- =============================================
-- CLICK HEATMAP DATA
-- =============================================
CREATE TABLE click_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    notification_id UUID NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES subscribers (id) ON DELETE SET NULL,
    click_url VARCHAR(500),
    click_position JSONB,
    device_type VARCHAR(20),
    country VARCHAR(3),
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_click_events_notification ON click_events (notification_id);

CREATE INDEX idx_click_events_time ON click_events (clicked_at);

-- =============================================
-- API KEYS LOG (for rate limiting and audit)
-- =============================================
CREATE TABLE api_key_logs (
    id BIGSERIAL PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    status_code INT,
    response_time_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_site ON api_key_logs (site_id, created_at);

-- =============================================
-- Updated_at trigger function
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscribers_updated_at BEFORE UPDATE ON subscribers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_segments_updated_at BEFORE UPDATE ON segments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ab_tests_updated_at BEFORE UPDATE ON ab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at();