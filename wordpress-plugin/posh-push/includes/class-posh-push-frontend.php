<?php
/**
 * Posh Push Frontend Class
 * ========================
 * Handles all visitor-facing functionality:
 *   - Injects the Posh Push SDK JavaScript snippet into every page
 *   - Serves the service worker file from the site root (via a virtual route)
 *   - Optionally provides a [posh_push_button] shortcode for manual opt-in buttons
 *
 * @package PoshPush
 * @since   2.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class PoshPushFrontend {

    /** @var PoshPushCore */
    private $core;

    // ── Boot ─────────────────────────────────────────────────────────────────

    /**
     * Create the frontend subsystem and register WordPress hooks.
     *
     * @param PoshPushCore $core Plugin core instance.
     */
    public static function boot( $core ) {
        $instance = new self( $core );

        add_action( 'wp_enqueue_scripts',  array( $instance, 'enqueue_sdk' ) );
        add_action( 'parse_request',       array( $instance, 'maybe_serve_service_worker' ) );
        add_shortcode( 'posh_push_button', array( $instance, 'shortcode_subscribe_button' ) );
    }

    private function __construct( PoshPushCore $core ) {
        $this->core = $core;
    }

    // ── SDK injection ────────────────────────────────────────────────────────

    /**
     * Enqueue the Posh Push SDK script and output the init call via wp_add_inline_script().
     *
     * The SDK expects:
     *   PoshPush.init({ apiKey, serverUrl, promptDelay })
     *
     * This method does nothing if the API key or site ID are not configured.
     */
    public function enqueue_sdk() {
        $api_key    = $this->core->api_key();
        $server_url = $this->core->server_url();
        $site_id    = $this->core->site_id();

        // Do not inject if plugin is not configured
        if ( empty( $api_key ) || empty( $site_id ) ) {
            return;
        }

        $sdk_url = $server_url . '/sdk/posh-push.js';

        wp_enqueue_script(
            'posh-push-sdk',
            $sdk_url,
            array(),           // No dependencies
            POSH_PUSH_VERSION,
            true               // Load in footer
        );

        // Build the inline initialisation call
        $prompt_delay = absint( $this->core->get_setting( 'prompt_delay', 3 ) );

        $init_config = wp_json_encode( array(
            'apiKey'      => $api_key,
            'serverUrl'   => $server_url,
            'promptDelay' => $prompt_delay,
        ) );

        $inline_script = sprintf(
            'if (typeof PoshPush !== "undefined") { PoshPush.init(%s); }',
            $init_config
        );

        wp_add_inline_script( 'posh-push-sdk', $inline_script );
    }

    // ── Service worker proxy ─────────────────────────────────────────────────

    /**
     * Intercept requests for /posh-push-sw.js at the WordPress root and proxy the
     * file from the Posh Push backend. The service worker MUST be served from the
     * same origin as the site to have the correct scope.
     *
     * @param WP $wp WordPress request object.
     */
    public function maybe_serve_service_worker( $wp ) {
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';

        $request_path = rtrim( strtok( $request_uri, '?' ), '/' );
        if ( substr_compare( $request_path, '/posh-push-sw.js', -strlen( '/posh-push-sw.js' ) ) !== 0 ) {
            return;
        }

        $server_url = $this->core->server_url();
        if ( empty( $server_url ) ) {
            return;
        }

        // Fetch service worker content from backend
        $response = wp_remote_get(
            $server_url . '/sdk/posh-push-sw.js',
            array( 'timeout' => 10 )
        );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            status_header( 502 );
            echo '/* Posh Push service worker unavailable */';
            exit;
        }

        header( 'Content-Type: application/javascript; charset=UTF-8' );
        header( 'Service-Worker-Allowed: /' );
        // Allow browsers to cache for up to 24 hours
        header( 'Cache-Control: public, max-age=86400' );

        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo wp_remote_retrieve_body( $response );
        exit;
    }

    // ── Shortcode ────────────────────────────────────────────────────────────

    /**
     * [posh_push_button label="Subscribe" class="my-btn"] shortcode.
     * Renders a button that calls PoshPush.subscribe() when clicked.
     *
     * @param  array  $atts Shortcode attributes.
     * @return string       Button HTML.
     */
    public function shortcode_subscribe_button( $atts ) {
        $atts = shortcode_atts(
            array(
                'label' => __( '🔔 Subscribe for notifications', 'posh-push' ),
                'class' => 'posh-push-subscribe-btn',
            ),
            $atts,
            'posh_push_button'
        );

        return sprintf(
            '<button class="%s" onclick="if(typeof PoshPush!==\'undefined\'){PoshPush.subscribe()}" type="button">%s</button>',
            esc_attr( $atts['class'] ),
            esc_html( $atts['label'] )
        );
    }
}
