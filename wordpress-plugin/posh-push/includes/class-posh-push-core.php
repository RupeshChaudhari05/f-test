<?php
/**
 * Posh Push Core Class
 * ====================
 * Singleton that bootstraps all subsystems: admin settings panel, frontend
 * SDK injection, background API requests, and the REST API bridge.
 *
 * @package PoshPush
 * @since   2.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class PoshPushCore {

    /** @var PoshPushCore|null Singleton instance */
    private static $instance = null;

    /** @var array Cached plugin settings */
    private $settings = array();

    // ── Singleton factory ────────────────────────────────────────────────────

    /**
     * Return (and lazily create) the singleton instance.
     *
     * @return PoshPushCore
     */
    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** Private constructor – use get_instance(). */
    private function __construct() {
        $this->settings = (array) get_option( POSH_PUSH_OPTION_KEY, array() );

        // Boot subsystems
        PoshPushAdmin::boot( $this );
        PoshPushFrontend::boot( $this );
        PoshPushApi::boot( $this );
    }

    // ── Activation / Deactivation ────────────────────────────────────────────

    /**
     * Runs on plugin activation.
     * Stores a flag with the activation timestamp and flushes rewrite rules.
     */
    public static function activate() {
        update_option( 'posh_push_activated_at', time() );
        flush_rewrite_rules();
    }

    /**
     * Runs on plugin deactivation.
     * Flushes rewrite rules; settings are intentionally preserved.
     */
    public static function deactivate() {
        flush_rewrite_rules();
    }

    // ── Settings helpers ─────────────────────────────────────────────────────

    /**
     * Retrieve a specific setting with an optional default value.
     *
     * @param  string $key     Setting key.
     * @param  mixed  $default Fallback value when the key is not set.
     * @return mixed
     */
    public function get_setting( $key, $default = '' ) {
        return $this->settings[ $key ] ?? $default;
    }

    /**
     * Return the full settings array (used by admin and frontend classes).
     *
     * @return array
     */
    public function get_all_settings() {
        return $this->settings;
    }

    /**
     * Helper: return the configured Posh Push server URL, with no trailing slash.
     *
     * Priority:
     *   1. POSH_PUSH_SERVER_URL constant defined in wp-config.php  (best for deployments)
     *   2. Value saved in WP admin → Posh Push → Settings
     *   3. Default fallback
     *
     * To lock the URL via wp-config.php add:
     *   define( 'POSH_PUSH_SERVER_URL', 'https://api.yourdomain.com' );
     *
     * @return string
     */
    public function server_url() {
        if ( defined( 'POSH_PUSH_SERVER_URL' ) ) {
            return rtrim( POSH_PUSH_SERVER_URL, '/' );
        }
        return rtrim( $this->get_setting( 'server_url', 'http://localhost:3000' ), '/' );
    }

    /**
     * Helper: return the site API key (set once in WP Admin → Posh Push → Settings).
     *
     * @return string
     */
    public function api_key() {
        return $this->get_setting( 'api_key', '' );
    }

    /**
     * Helper: return the site ID.
     *
     * @return string
     */
    public function site_id() {
        return $this->get_setting( 'site_id', '' );
    }

    /**
     * Make an authenticated request to the Posh Push API.
     *
     * @param  string $endpoint  Path relative to /api/v1/ (e.g. 'sites/123/notifications/send').
     * @param  string $method    HTTP method ('GET', 'POST', etc.).
     * @param  array  $body      Request body (will be JSON-encoded for non-GET requests).
     * @return array{status: int, body: mixed} Response status code and decoded body.
     */
    public function api_request( $endpoint, $method = 'GET', $body = array() ) {
        $url = $this->server_url() . '/api/v1/' . ltrim( $endpoint, '/' );

        $args = array(
            'method'  => strtoupper( $method ),
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Api-Key'    => $this->api_key(),
            ),
            'timeout' => 15,
        );

        $method = strtoupper( $method );
        if ( ! empty( $body ) && 'GET' !== $method ) {
            $args['body'] = wp_json_encode( $body );
        }

        $response = wp_remote_request( $url, $args );

        if ( is_wp_error( $response ) ) {
            return array(
                'status' => 0,
                'body'   => array( 'error' => $response->get_error_message() ),
            );
        }

        $body_raw     = wp_remote_retrieve_body( $response );
        $decoded_body = json_decode( $body_raw, true );

        if ( null === $decoded_body && '' !== trim( $body_raw ) ) {
            $decoded_body = array( 'raw' => $body_raw );
        }

        return array(
            'status' => (int) wp_remote_retrieve_response_code( $response ),
            'body'   => $decoded_body ?? array(),
        );
    }
}
