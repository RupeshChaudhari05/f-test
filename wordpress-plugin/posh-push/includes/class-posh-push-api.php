<?php
/**
 * Posh Push REST API Bridge
 * =========================
 * Registers WP REST API endpoints that allow JavaScript running on the
 * WordPress frontend to reach the Posh Push backend without exposing the
 * API key to the browser.
 *
 * All endpoints require the caller to be logged-in (or pass nonce auth)
 * unless explicitly marked public (e.g. subscriber registration).
 *
 * Namespace: posh-push/v1
 *
 * Routes
 * ------
 *   POST /wp-json/posh-push/v1/subscribe   — Register a new subscriber
 *   POST /wp-json/posh-push/v1/unsubscribe — Remove a subscriber
 *   GET  /wp-json/posh-push/v1/stats       — Return site subscriber count (admin)
 *
 * @package PoshPush
 * @since   2.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class PoshPushApi {

    /** @var PoshPushCore */
    private $core;

    /** REST namespace */
    private const NAMESPACE = 'posh-push/v1';

    // ── Boot ─────────────────────────────────────────────────────────────────

    /**
     * Create the API subsystem and register WordPress hooks.
     *
     * @param PoshPushCore $core Plugin core instance.
     */
    public static function boot( $core ) {
        $instance = new self( $core );
        add_action( 'rest_api_init', array( $instance, 'register_routes' ) );
    }

    private function __construct( PoshPushCore $core ) {
        $this->core = $core;
    }

    // ── Route registration ────────────────────────────────────────────────────

    /**
     * Register all REST routes.
     */
    public function register_routes() {
        // POST /wp-json/posh-push/v1/subscribe
        register_rest_route(
            self::NAMESPACE,
            '/subscribe',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_subscribe' ),
                'permission_callback' => '__return_true', // Public – verified by nonce in body
                'args'                => array(
                    'endpoint' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                    ),
                    'p256dh' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'auth' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'nonce' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            )
        );

        // POST /wp-json/posh-push/v1/unsubscribe
        register_rest_route(
            self::NAMESPACE,
            '/unsubscribe',
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'handle_unsubscribe' ),
                'permission_callback' => '__return_true',
                'args'                => array(
                    'endpoint' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                    ),
                    'nonce' => array(
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            )
        );

        // GET /wp-json/posh-push/v1/stats  (admin only)
        register_rest_route(
            self::NAMESPACE,
            '/stats',
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'handle_stats' ),
                'permission_callback' => array( $this, 'require_manage_options' ),
            )
        );
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    /**
     * Handle a new subscriber registration from the browser SDK.
     *
     * Verifies the WP nonce, then proxies the subscription to the Posh Push
     * backend so the API key is never exposed to the browser.
     *
     * @param  \WP_REST_Request $request Incoming REST request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function handle_subscribe( $request ) {
        // Verify the WordPress nonce for CSRF protection
        if ( ! wp_verify_nonce( $request->get_param( 'nonce' ), 'posh_push_subscribe' ) ) {
            return new \WP_Error( 'invalid_nonce', 'Security check failed.', array( 'status' => 403 ) );
        }

        $site_id = $this->core->site_id();
        if ( empty( $site_id ) ) {
            return new \WP_Error( 'not_configured', 'Plugin not configured.', array( 'status' => 500 ) );
        }

        $result = $this->core->api_request(
            'sites/' . $site_id . '/subscribers',
            'POST',
            array(
                'endpoint' => $request->get_param( 'endpoint' ),
                'p256dh'   => $request->get_param( 'p256dh' ),
                'auth'     => $request->get_param( 'auth' ),
                'source'   => 'wordpress',
                'tags'     => array( 'wordpress' ),
            )
        );

        return rest_ensure_response(
            array(
                'success' => $result['status'] >= 200 && $result['status'] < 300,
                'data'    => $result['body'],
            )
        );
    }

    /**
     * Handle unsubscribe requests from the browser SDK.
     *
     * @param  \WP_REST_Request $request Incoming REST request.
     * @return \WP_REST_Response|\WP_Error
     */
    public function handle_unsubscribe( $request ) {
        if ( ! wp_verify_nonce( $request->get_param( 'nonce' ), 'posh_push_subscribe' ) ) {
            return new \WP_Error( 'invalid_nonce', 'Security check failed.', array( 'status' => 403 ) );
        }

        $site_id  = $this->core->site_id();
        $endpoint = $request->get_param( 'endpoint' );

        if ( empty( $site_id ) ) {
            return new \WP_Error( 'not_configured', 'Plugin not configured.', array( 'status' => 500 ) );
        }

        // The backend identifies subscribers by their push endpoint URL
        $result = $this->core->api_request(
            'sites/' . $site_id . '/subscribers/by-endpoint',
            'DELETE',
            array( 'endpoint' => $endpoint )
        );

        return rest_ensure_response(
            array(
                'success' => $result['status'] >= 200 && $result['status'] < 300,
            )
        );
    }

    /**
     * Return subscriber stats for the current site (admin-only).
     *
     * @return \WP_REST_Response|\WP_Error
     */
    public function handle_stats() {
        $site_id = $this->core->site_id();
        if ( empty( $site_id ) ) {
            return new \WP_Error( 'not_configured', 'Plugin not configured.', array( 'status' => 500 ) );
        }

        $result = $this->core->api_request( 'sites/' . $site_id . '/stats' );

        if ( $result['status'] >= 200 && $result['status'] < 300 ) {
            return rest_ensure_response( $result['body'] );
        }

        return new \WP_Error( 'api_error', 'Failed to fetch stats.', array( 'status' => $result['status'] ) );
    }

    // ── Permission callbacks ──────────────────────────────────────────────────

    /**
     * Permission callback: require the manage_options capability.
     *
     * @return bool|\WP_Error
     */
    public function require_manage_options() {
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }
        return new \WP_Error( 'forbidden', 'Insufficient permissions.', array( 'status' => 403 ) );
    }
}
