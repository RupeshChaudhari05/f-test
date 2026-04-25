<?php
/**
 * Posh Push Admin Class
 * =====================
 * Handles all WordPress admin-side functionality:
 *   - Settings menu page with tabbed UI
 *   - Settings registration via the Settings API
 *   - AJAX handlers for manual sends and send tests
 *   - Automatic notification on new post publication
 *
 * @package PoshPush
 * @since   2.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class PoshPushAdmin {

    /** @var PoshPushCore */
    private $core;

    // ── Boot ─────────────────────────────────────────────────────────────────

    /**
     * Create the admin subsystem and register WordPress hooks.
     *
     * @param PoshPushCore $core Plugin core instance.
     */
    public static function boot( $core ) {
        $instance = new self( $core );

        add_action( 'admin_menu',             array( $instance, 'add_menu_page' ) );
        add_action( 'admin_init',             array( $instance, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts',  array( $instance, 'enqueue_admin_assets' ) );
        add_action( 'transition_post_status', array( $instance, 'on_post_published' ), 10, 3 );

        // Authenticated AJAX actions
        add_action( 'wp_ajax_posh_push_test_connection', array( $instance, 'ajax_test_connection' ) );
        add_action( 'wp_ajax_posh_push_send_manual',     array( $instance, 'ajax_send_manual' ) );
    }

    private function __construct( PoshPushCore $core ) {
        $this->core = $core;
    }

    // ── Admin menu ───────────────────────────────────────────────────────────

    /**
     * Register a top-level "Posh Push" menu item in wp-admin.
     */
    public function add_menu_page() {
        add_menu_page(
            __( 'Posh Push Notifications', 'posh-push' ),
            __( 'Posh Push', 'posh-push' ),
            'manage_options',
            'posh-push',
            array( $this, 'render_settings_page' ),
            'dashicons-bell',
            75
        );
    }

    // ── Settings API ─────────────────────────────────────────────────────────

    /**
     * Register all plugin settings so WordPress handles sanitisation and storage.
     */
    public function register_settings() {
        register_setting(
            'posh_push_settings_group',
            POSH_PUSH_OPTION_KEY,
            array( $this, 'sanitize_settings' )
        );

        // ── Connection section ───────────────────────────────────────────────
        add_settings_section(
            'posh_push_connection',
            __( 'API Connection', 'posh-push' ),
            '__return_false',
            'posh-push'
        );

        $connection_fields = array(
            'server_url' => array(
                'label'       => __( 'Server URL', 'posh-push' ),
                'type'        => 'url',
                'placeholder' => 'http://localhost:3000',
                'description' => __( 'Base URL of your Posh Push backend server.', 'posh-push' ),
            ),
            'api_key' => array(
                'label'       => __( 'API Key', 'posh-push' ),
                'type'        => 'text',
                'placeholder' => __( 'Paste your site API key here', 'posh-push' ),
                'description' => __( 'Found in Posh Push Dashboard → Site Settings → API Key.', 'posh-push' ),
            ),
        );

        foreach ( $connection_fields as $key => $field ) {
            add_settings_field(
                'posh_push_' . $key,
                $field['label'],
                array( $this, 'render_field' ),
                'posh-push',
                'posh_push_connection',
                array_merge( $field, array( 'key' => $key ) )
            );
        }

        // ── Behaviour section ────────────────────────────────────────────────
        add_settings_section(
            'posh_push_behaviour',
            __( 'Behaviour', 'posh-push' ),
            '__return_false',
            'posh-push'
        );

        add_settings_field(
            'posh_push_auto_notify',
            __( 'Auto-notify on publish', 'posh-push' ),
            array( $this, 'render_field' ),
            'posh-push',
            'posh_push_behaviour',
            array(
                'key'         => 'auto_notify',
                'type'        => 'checkbox',
                'label'       => __( 'Send a push notification when a post is published', 'posh-push' ),
                'description' => __( 'Uses the post title and excerpt.', 'posh-push' ),
            )
        );

        add_settings_field(
            'posh_push_post_types',
            __( 'Post Types', 'posh-push' ),
            array( $this, 'render_field' ),
            'posh-push',
            'posh_push_behaviour',
            array(
                'key'         => 'post_types',
                'type'        => 'text',
                'placeholder' => 'post,product',
                'description' => __( 'Comma-separated list of post types that trigger auto-notify.', 'posh-push' ),
            )
        );

        add_settings_field(
            'posh_push_prompt_delay',
            __( 'Prompt delay (seconds)', 'posh-push' ),
            array( $this, 'render_field' ),
            'posh-push',
            'posh_push_behaviour',
            array(
                'key'         => 'prompt_delay',
                'type'        => 'number',
                'placeholder' => '3',
                'description' => __( 'How long to wait before showing the subscribe prompt.', 'posh-push' ),
            )
        );
    }

    /**
     * Sanitise and validate settings before saving.
     *
     * @param  array $input Raw $_POST input.
     * @return array        Sanitised settings.
     */
    public function sanitize_settings( $input ) {
        $clean = array();

        $clean['server_url']    = esc_url_raw( $input['server_url'] ?? '' );
        $clean['api_key']       = sanitize_text_field( $input['api_key'] ?? '' );
        $clean['auto_notify']   = isset( $input['auto_notify'] ) ? '1' : '0';
        $clean['post_types']    = sanitize_text_field( $input['post_types'] ?? 'post' );
        $clean['prompt_delay']  = absint( $input['prompt_delay'] ?? 3 );

        return $clean;
    }

    // ── Field renderer ───────────────────────────────────────────────────────

    /**
     * Generic field renderer used by add_settings_field().
     *
     * @param array $args Field configuration array.
     */
    public function render_field( $args ) {
        $key   = $args['key'];
        $value = $this->core->get_setting( $key, $args['placeholder'] ?? '' );
        $name  = POSH_PUSH_OPTION_KEY . '[' . $key . ']';
        $id    = 'posh_push_' . $key;

        switch ( $args['type'] ) {
            case 'checkbox':
                printf(
                    '<label><input type="checkbox" id="%s" name="%s" value="1" %s /> %s</label>',
                    esc_attr( $id ),
                    esc_attr( $name ),
                    checked( '1', $value, false ),
                    esc_html( $args['label'] ?? '' )
                );
                break;

            default:
                printf(
                    '<input class="regular-text" type="%s" id="%s" name="%s" value="%s" placeholder="%s" />',
                    esc_attr( $args['type'] ),
                    esc_attr( $id ),
                    esc_attr( $name ),
                    esc_attr( (string) $value ),
                    esc_attr( $args['placeholder'] ?? '' )
                );
                break;
        }

        if ( ! empty( $args['description'] ) ) {
            echo '<p class="description">' . esc_html( $args['description'] ) . '</p>';
        }
    }

    // ── Settings page renderer ───────────────────────────────────────────────

    /**
     * Output the admin settings page HTML.
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'posh-push' ) );
        }

        // Determine active tab
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'settings';

        include POSH_PUSH_DIR . 'admin/settings-page.php';
    }

    // ── Admin assets ─────────────────────────────────────────────────────────

    /**
     * Enqueue admin CSS/JS only on the plugin settings page.
     *
     * @param string $hook Current admin page hook.
     */
    public function enqueue_admin_assets( $hook ) {
        if ( 'toplevel_page_posh-push' !== $hook ) {
            return;
        }

        wp_enqueue_style(
            'posh-push-admin',
            POSH_PUSH_URL . 'admin/admin.css',
            array(),
            POSH_PUSH_VERSION
        );

        wp_enqueue_script(
            'posh-push-admin',
            POSH_PUSH_URL . 'admin/admin.js',
            array( 'jquery' ),
            POSH_PUSH_VERSION,
            true
        );

        // Pass PHP data to JS
        wp_localize_script( 'posh-push-admin', 'poshPushAdmin', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'posh_push_admin' ),
        ) );
    }

    // ── Auto-notify on post publish ──────────────────────────────────────────

    /**
     * Fires when a post changes status; sends a push notification when a post
     * transitions from any status to "publish".
     *
     * @param string  $new_status New post status.
     * @param string  $old_status Previous post status.
     * @param WP_Post $post       Post object.
     */
    public function on_post_published( $new_status, $old_status, $post ) {
        // Only act on fresh publishes
        if ( 'publish' !== $new_status || 'publish' === $old_status ) {
            return;
        }

        // Only if auto-notify is enabled
        if ( '1' !== $this->core->get_setting( 'auto_notify', '0' ) ) {
            return;
        }

        // Check allowed post types
        $allowed_types = array_map( 'trim', explode( ',', $this->core->get_setting( 'post_types', 'post' ) ) );
        if ( ! in_array( $post->post_type, $allowed_types, true ) ) {
            return;
        }

        if ( empty( $this->core->api_key() ) ) {
            return;
        }

        $this->core->api_request(
            'sdk/notify',
            'POST',
            array(
                'title'   => wp_strip_all_tags( get_the_title( $post ) ),
                'message' => wp_trim_words( wp_strip_all_tags( $post->post_excerpt ?: $post->post_content ), 20 ),
                'url'     => get_permalink( $post ),
                'iconUrl' => has_post_thumbnail( $post ) ? get_the_post_thumbnail_url( $post, 'thumbnail' ) : '',
            )
        );
    }

    // ── AJAX handlers ────────────────────────────────────────────────────────

    /**
     * AJAX: test the API connection by listing sites.
     */
    public function ajax_test_connection() {
        check_ajax_referer( 'posh_push_admin', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => 'Forbidden.' ), 403 );
        }

        if ( empty( $this->core->api_key() ) ) {
            wp_send_json_error( array( 'message' => 'API Key is not configured.' ) );
        }

        $result = $this->core->api_request( 'sdk/config' );
        if ( $result['status'] >= 200 && $result['status'] < 300 ) {
            $site_id = $result['body']['siteId'] ?? '';
            wp_send_json_success( array(
                'message' => 'Connection successful! Site ID: ' . $site_id,
                'siteId'  => $site_id,
            ) );
        } else {
            wp_send_json_error( array( 'message' => 'Connection failed. Check your API Key. Status: ' . $result['status'] ) );
        }
    }

    /**
     * AJAX: send a manual notification from the admin settings page.
     */
    public function ajax_send_manual() {
        check_ajax_referer( 'posh_push_admin', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( array( 'message' => 'Forbidden.' ), 403 );
        }

        $title   = sanitize_text_field( wp_unslash( $_POST['title']   ?? '' ) );
        $message = sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) );
        $url     = esc_url_raw( wp_unslash( $_POST['url'] ?? '' ) );

        if ( empty( $title ) || empty( $message ) ) {
            wp_send_json_error( array( 'message' => 'Title and message are required.' ) );
        }

        if ( empty( $this->core->api_key() ) ) {
            wp_send_json_error( array( 'message' => 'API Key is not configured in Posh Push settings.' ) );
        }

        $result = $this->core->api_request(
            'sdk/notify',
            'POST',
            array(
                'title'   => $title,
                'message' => $message,
                'url'     => $url ?: get_home_url(),
            )
        );

        if ( $result['status'] >= 200 && $result['status'] < 300 ) {
            wp_send_json_success( array( 'message' => 'Notification sent successfully!' ) );
        } else {
            wp_send_json_error( array(
                'message' => 'Failed to send. API responded with status ' . $result['status'],
            ) );
        }
    }
}
