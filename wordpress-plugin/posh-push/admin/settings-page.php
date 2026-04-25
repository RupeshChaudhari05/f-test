<?php
/**
 * Posh Push Admin Settings Page
 * ==============================
 * Tabbed settings UI rendered by PoshPushAdmin::render_settings_page().
 * This is a view file — no business logic here.
 *
 * Available tabs:
 *   - settings  : API connection + behaviour options
 *   - send       : Quick manual notification sender
 *   - help       : Setup guide and shortcode reference
 *
 * Variables available from the calling method:
 *   $tab   (string) — active tab slug
 *
 * @package PoshPush
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$tabs = array(
    'settings' => __( '⚙️ Settings', 'posh-push' ),
    'send'     => __( '📬 Send Notification', 'posh-push' ),
    'help'     => __( '📖 Setup Guide', 'posh-push' ),
);
?>
<div class="wrap posh-push-admin">
    <h1 class="wp-heading-inline">
        🔔 <?php esc_html_e( 'Posh Push Notifications', 'posh-push' ); ?>
    </h1>
    <span class="posh-version-badge">v<?php echo esc_html( POSH_PUSH_VERSION ); ?></span>
    <hr class="wp-header-end" />

    <!-- Tab navigation -->
    <nav class="nav-tab-wrapper posh-push-tabs">
        <?php foreach ( $tabs as $slug => $label ) : ?>
            <a
                href="<?php echo esc_url( admin_url( 'admin.php?page=posh-push&tab=' . $slug ) ); ?>"
                class="nav-tab <?php echo $tab === $slug ? 'nav-tab-active' : ''; ?>"
            >
                <?php echo esc_html( $label ); ?>
            </a>
        <?php endforeach; ?>
    </nav>

    <!-- ── Settings tab ──────────────────────────────────────────────── -->
    <?php if ( 'settings' === $tab ) : ?>
        <div class="posh-tab-content">
            <?php settings_errors( 'posh_push_settings' ); ?>

            <form method="post" action="options.php">
                <?php
                settings_fields( 'posh_push_settings_group' );
                do_settings_sections( 'posh-push' );
                submit_button( __( 'Save Settings', 'posh-push' ) );
                ?>
            </form>

            <hr />

            <!-- Test connection -->
            <h3><?php esc_html_e( 'Test API Connection', 'posh-push' ); ?></h3>
            <p><?php esc_html_e( 'Click to verify that WordPress can reach your Posh Push backend.', 'posh-push' ); ?></p>
            <button id="posh-test-connection" class="button button-secondary">
                <?php esc_html_e( 'Test Connection', 'posh-push' ); ?>
            </button>
            <span id="posh-test-result" style="margin-left:12px; font-weight:600;"></span>
        </div>

    <!-- ── Send tab ──────────────────────────────────────────────────── -->
    <?php elseif ( 'send' === $tab ) : ?>
        <div class="posh-tab-content">
            <h2><?php esc_html_e( 'Send a Manual Notification', 'posh-push' ); ?></h2>
            <p><?php esc_html_e( 'Instantly push a notification to all subscribers.', 'posh-push' ); ?></p>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="posh-manual-title"><?php esc_html_e( 'Title', 'posh-push' ); ?></label></th>
                    <td><input type="text" id="posh-manual-title" class="regular-text" placeholder="<?php esc_attr_e( 'Notification title…', 'posh-push' ); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="posh-manual-message"><?php esc_html_e( 'Message', 'posh-push' ); ?></label></th>
                    <td><textarea id="posh-manual-message" rows="4" class="large-text" placeholder="<?php esc_attr_e( 'Notification body…', 'posh-push' ); ?>"></textarea></td>
                </tr>
                <tr>
                    <th scope="row"><label for="posh-manual-url"><?php esc_html_e( 'Click URL', 'posh-push' ); ?></label></th>
                    <td>
                        <input type="url" id="posh-manual-url" class="regular-text" value="<?php echo esc_url( home_url() ); ?>" />
                        <p class="description"><?php esc_html_e( 'Where subscribers are taken when they click the notification.', 'posh-push' ); ?></p>
                    </td>
                </tr>
            </table>

            <button id="posh-send-manual" class="button button-primary">
                <?php esc_html_e( 'Send Notification', 'posh-push' ); ?>
            </button>
            <span id="posh-send-result" style="margin-left:12px; font-weight:600;"></span>
        </div>

    <!-- ── Help tab ──────────────────────────────────────────────────── -->
    <?php elseif ( 'help' === $tab ) : ?>
        <div class="posh-tab-content">
            <h2><?php esc_html_e( 'Setup Guide', 'posh-push' ); ?></h2>

            <ol class="posh-setup-steps">
                <li>
                    <strong><?php esc_html_e( 'Create a site in your Posh Push dashboard', 'posh-push' ); ?></strong>
                    <p><?php esc_html_e( 'Log in at your Posh Push server URL → Dashboard → Sites → New Site.', 'posh-push' ); ?></p>
                </li>
                <li>
                    <strong><?php esc_html_e( 'Copy your API Key and Site ID', 'posh-push' ); ?></strong>
                    <p><?php esc_html_e( 'Found in Dashboard → Settings for your site.', 'posh-push' ); ?></p>
                </li>
                <li>
                    <strong><?php esc_html_e( 'Paste them into the Settings tab', 'posh-push' ); ?></strong>
                    <p><?php esc_html_e( 'Don\'t forget to also set the Server URL and save.', 'posh-push' ); ?></p>
                </li>
                <li>
                    <strong><?php esc_html_e( 'Visit your site', 'posh-push' ); ?></strong>
                    <p><?php esc_html_e( 'The subscribe prompt will appear after the configured delay.', 'posh-push' ); ?></p>
                </li>
            </ol>

            <hr />

            <h2><?php esc_html_e( 'Shortcode Reference', 'posh-push' ); ?></h2>
            <table class="widefat">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Shortcode', 'posh-push' ); ?></th>
                        <th><?php esc_html_e( 'Description', 'posh-push' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>[posh_push_button]</code></td>
                        <td><?php esc_html_e( 'Renders a subscribe button that triggers the browser opt-in prompt.', 'posh-push' ); ?></td>
                    </tr>
                    <tr>
                        <td><code>[posh_push_button label="Join!"]</code></td>
                        <td><?php esc_html_e( 'Custom button label.', 'posh-push' ); ?></td>
                    </tr>
                    <tr>
                        <td><code>[posh_push_button class="my-btn"]</code></td>
                        <td><?php esc_html_e( 'Custom CSS class for styling.', 'posh-push' ); ?></td>
                    </tr>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div><!-- .wrap -->
