<?php
/**
 * Plugin Name: Posh Push Notifications
 * Plugin URI: https://poshnotify.com
 * Description: Easy web push notifications for WordPress. Connect to the Posh Notification System for subscriber management, targeting, and analytics.
 * Version: 1.0.0
 * Author: Posh Notify
 * License: GPL v2 or later
 * Text Domain: posh-push
 */

if (!defined('ABSPATH')) {
    exit;
}

define('POSH_PUSH_VERSION', '1.0.0');

// Plugin deactivation function
function posh_push_deactivate() {
    // Flush rewrite rules on deactivation
    flush_rewrite_rules();
    delete_option('posh_push_rewrite_flushed');
}

// Activation hook
register_activation_hook(__FILE__, function() {
    flush_rewrite_rules();
});

// Deactivation hook
register_deactivation_hook(__FILE__, 'posh_push_deactivate');

// Initialize the plugin after WordPress is fully loaded
if (function_exists('add_action')) {
    add_action('plugins_loaded', function() {
        // Define plugin constants
        if (!defined('POSH_PUSH_PLUGIN_DIR')) {
            define('POSH_PUSH_PLUGIN_DIR', plugin_dir_path(__FILE__));
            define('POSH_PUSH_PLUGIN_URL', plugin_dir_url(__FILE__));
        }

        // Plugin deactivation hook (already registered above)
        // posh_push_deactivate function is defined below

        PoshPushNotifications::getInstance();
    });
}

class PoshPushNotifications {

    public function addAdminMenu() {
        add_menu_page(
            __('Posh Push', 'posh-push'),
            __('Posh Push', 'posh-push'),
            'manage_options',
            'posh-push',
            [$this, 'renderSettingsPage'],
            'dashicons-bell',
            80
        );

        add_submenu_page(
            'posh-push',
            __('Settings', 'posh-push'),
            __('Settings', 'posh-push'),
            'manage_options',
            'posh-push',
            [$this, 'renderSettingsPage']
        );

        add_submenu_page(
            'posh-push',
            __('Subscribers', 'posh-push'),
            __('Subscribers', 'posh-push'),
            'manage_options',
            'posh-push-subscribers',
            [$this, 'renderSubscribersPage']
        );
    }

    public function registerSettings() {
        register_setting('posh_push_settings', 'posh_push_api_key', [
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);
        register_setting('posh_push_settings', 'posh_push_server_url', [
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => 'http://localhost:3000',
        ]);
        register_setting('posh_push_settings', 'posh_push_auto_notify', [
            'type' => 'boolean',
            'default' => true,
        ]);
        register_setting('posh_push_settings', 'posh_push_post_types', [
            'type' => 'array',
            'default' => ['post'],
        ]);
    }

    public function enqueueFrontendScripts() {
        $apiKey = get_option('posh_push_api_key');
        if (empty($apiKey)) return;

        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');

        // Load SDK from backend static files
        wp_enqueue_script(
            'posh-push-sdk',
            $serverUrl . '/sdk/posh-push.min.js',
            [],
            POSH_PUSH_VERSION,
            true
        );

        // Initialize SDK with proper error handling
        wp_add_inline_script('posh-push-sdk', sprintf(
            'document.addEventListener("DOMContentLoaded", function() {
                console.log("[Posh Push] Initializing SDK...");
                if (typeof window.PoshPush !== "undefined") {
                    try {
                        window.PoshPush.init({
                            apiKey: %s,
                            serverUrl: %s
                        });
                        console.log("[Posh Push] SDK initialized successfully");
                    } catch (error) {
                        console.error("[Posh Push] Initialization error:", error);
                    }
                } else {
                    console.warn("[Posh Push] SDK library not loaded. Check:", %s);
                }
            });',
            wp_json_encode($serverUrl . "/sdk/posh-push.min.js"),
            wp_json_encode($apiKey),
            wp_json_encode($serverUrl)
        ));
    }
    public function getServiceWorkerContent($serverUrl) {
        $swUrl = $serverUrl . '/sdk/posh-push-sw.min.js';

        // Validate URL to prevent SSRF
        $parsed = wp_parse_url($swUrl);
        if (!$parsed || !in_array($parsed['scheme'], ['http', 'https'], true)) {
            return false;
        }

        $response = wp_remote_get($swUrl, [
            'timeout' => 10,
            'sslverify' => false,
        ]);
        if (is_wp_error($response)) {
            return false;
        }

        return wp_remote_retrieve_body($response);
    }

    public function serveServiceWorker() {
        header('Content-Type: application/javascript');
        header('Service-Worker-Allowed: /');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');
        $content = $this->getServiceWorkerContent($serverUrl);

        if ($content) {
            echo $content;
        } else {
            // Fallback service worker content
            echo $this->getFallbackServiceWorker();
        }
        exit;
    }

    private function getFallbackServiceWorker() {
        return <<<JS
// Fallback Posh Push Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'POSH_PUSH_CONFIG') {
    // Store config for later use
    self.poshConfig = event.data.config;
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: data.badge,
      image: data.image,
      tag: data.tag || 'posh-push',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
      data: {
        url: data.url || '/',
        ...data.data
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  } catch (error) {
    console.error('Service Worker push event error:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );

  // Send message to client about notification click
  event.waitUntil(
    clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'POSH_NOTIFICATION_CLICK',
          payload: event.notification.data
        });
      });
    })
  );
});
JS;
    }
    public function registerServiceWorker() {
        $apiKey = get_option('posh_push_api_key');
        if (empty($apiKey)) return;

        // Handle service worker requests
        add_action('parse_request', function($wp) {
            if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/posh-push-sw.js') !== false) {
                $this->serveServiceWorker();
            }
        });
    }

    public function onPostPublished($newStatus, $oldStatus, $post) {
        if ($newStatus !== 'publish' || $oldStatus === 'publish') return;
        if (!get_option('posh_push_auto_notify', true)) return;

        $allowedTypes = get_option('posh_push_post_types', ['post']);
        if (!in_array($post->post_type, $allowedTypes)) return;

        $apiKey = get_option('posh_push_api_key');
        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');

        if (empty($apiKey)) return;

        $thumbnail = get_the_post_thumbnail_url($post->ID, 'medium');
        $excerpt = wp_strip_all_tags(get_the_excerpt($post));
        if (empty($excerpt)) {
            $excerpt = wp_trim_words(wp_strip_all_tags($post->post_content), 20);
        }

        $payload = [
            'event' => 'post_published',
            'data' => [
                'title' => $post->post_title,
                'excerpt' => $excerpt,
                'url' => get_permalink($post->ID),
                'thumbnail' => $thumbnail ?: null,
                'post_id' => $post->ID,
                'post_type' => $post->post_type,
            ],
        ];

        // Send webhook to Posh server
        wp_remote_post($serverUrl . '/api/v1/webhooks/wordpress', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-api-key' => $apiKey,
            ],
            'body' => wp_json_encode($payload),
            'timeout' => 15,
            'sslverify' => false,
        ]);
    }

    public function handleTestNotification() {
        check_ajax_referer('posh_push_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        $apiKey = get_option('posh_push_api_key');
        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');

        if (empty($apiKey)) {
            wp_send_json_error(['message' => 'API key not configured']);
            return;
        }

        $response = wp_remote_get($serverUrl . '/api/v1/sdk/config', [
            'headers' => [
                'x-api-key' => $apiKey,
                'Content-Type' => 'application/json'
            ],
            'timeout' => 10,
            'sslverify' => false,
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error([
                'message' => 'Connection failed: ' . $response->get_error_message(),
                'serverUrl' => $serverUrl
            ]);
            return;
        }

        $statusCode = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($statusCode !== 200) {
            wp_send_json_error([
                'message' => 'Server error: ' . ($body['message'] ?? 'HTTP ' . $statusCode),
                'statusCode' => $statusCode
            ]);
            return;
        }

        wp_send_json_success([
            'message' => 'Successfully connected!',
            'data' => $body
        ]);
    }

    public function handleSendNotification() {
        check_ajax_referer('posh_push_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized']);
            return;
        }

        $apiKey = get_option('posh_push_api_key');
        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');

        if (empty($apiKey)) {
            wp_send_json_error(['message' => 'API key not configured']);
            return;
        }

        $title   = sanitize_text_field($_POST['title'] ?? 'New Update');
        $message = sanitize_text_field($_POST['message'] ?? 'Check out our latest content!');
        $url     = esc_url_raw($_POST['url'] ?? get_home_url());

        // Send notification via SDK API key endpoint
        $sendPayload = [
            'title'   => $title,
            'message' => $message,
            'url'     => $url,
        ];

        $sendResponse = wp_remote_post($serverUrl . '/api/v1/sdk/notify', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-api-key'    => $apiKey,
            ],
            'body'      => wp_json_encode($sendPayload),
            'timeout'   => 15,
            'sslverify' => false,
        ]);

        if (is_wp_error($sendResponse)) {
            wp_send_json_error(['message' => 'Send failed: ' . $sendResponse->get_error_message()]);
            return;
        }

        $statusCode = wp_remote_retrieve_response_code($sendResponse);
        $body = json_decode(wp_remote_retrieve_body($sendResponse), true);

        if ($statusCode >= 400) {
            wp_send_json_error([
                'message' => $body['message'] ?? 'Server returned error ' . $statusCode,
            ]);
            return;
        }

        wp_send_json_success(['message' => 'Notification sent to all subscribers!']);
    }

    public function registerRestRoutes() {
        register_rest_route('posh-push/v1', '/status', [
            'methods' => 'GET',
            'callback' => function() {
                $apiKey = get_option('posh_push_api_key');
                return new WP_REST_Response([
                    'connected' => !empty($apiKey),
                    'version' => POSH_PUSH_VERSION,
                ], 200);
            },
            'permission_callback' => '__return_true',
        ]);
    }

    public function renderSettingsPage() {
        $apiKey = get_option('posh_push_api_key', '');
        $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');
        $autoNotify = get_option('posh_push_auto_notify', true);
        ?>
        <div class="wrap">
            <h1><?php _e('Posh Push Notifications', 'posh-push'); ?></h1>

            <form method="post" action="options.php">
                <?php settings_fields('posh_push_settings'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="posh_push_api_key"><?php _e('API Key', 'posh-push'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="posh_push_api_key" name="posh_push_api_key"
                                   value="<?php echo esc_attr($apiKey); ?>" class="regular-text"
                                   placeholder="Enter your API key from the Posh dashboard">
                            <p class="description">
                                <?php _e('Get your API key from the Posh Push dashboard after creating a site.', 'posh-push'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="posh_push_server_url"><?php _e('Server URL', 'posh-push'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="posh_push_server_url" name="posh_push_server_url"
                                   value="<?php echo esc_url($serverUrl); ?>" class="regular-text">
                            <p class="description">
                                <?php _e('Your Posh Push server URL. For development: http://localhost:3000', 'posh-push'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <?php _e('Auto Push on New Post', 'posh-push'); ?>
                        </th>
                        <td>
                            <label>
                                <input type="checkbox" name="posh_push_auto_notify" value="1"
                                       <?php checked($autoNotify); ?>>
                                <?php _e('Automatically send push notification when a new post is published', 'posh-push'); ?>
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>

            <hr>
            <h2><?php _e('Connection Test', 'posh-push'); ?></h2>
            <button type="button" id="posh-test-btn" class="button button-secondary">
                <?php _e('Test Connection', 'posh-push'); ?>
            </button>
            <span id="posh-test-result" style="margin-left:10px;"></span>

            <hr>
            <h2><?php _e('Send Notification', 'posh-push'); ?></h2>
            <p class="description"><?php _e('Send a push notification to all subscribers right now.', 'posh-push'); ?></p>
            <table class="form-table" style="max-width:600px;">
                <tr>
                    <th scope="row"><label for="posh-notif-title"><?php _e('Title', 'posh-push'); ?></label></th>
                    <td><input type="text" id="posh-notif-title" class="regular-text" placeholder="<?php _e('Notification title', 'posh-push'); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="posh-notif-message"><?php _e('Message', 'posh-push'); ?></label></th>
                    <td><input type="text" id="posh-notif-message" class="regular-text" placeholder="<?php _e('Notification message', 'posh-push'); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="posh-notif-url"><?php _e('Click URL', 'posh-push'); ?></label></th>
                    <td><input type="url" id="posh-notif-url" class="regular-text" value="<?php echo esc_url(get_home_url()); ?>"></td>
                </tr>
            </table>
            <button type="button" id="posh-send-btn" class="button button-primary">
                <?php _e('Send to All Subscribers', 'posh-push'); ?>
            </button>
            <span id="posh-send-result" style="margin-left:10px;"></span>

            <script>
            document.getElementById('posh-test-btn').addEventListener('click', function() {
                var resultEl = document.getElementById('posh-test-result');
                resultEl.textContent = 'Testing...';
                jQuery.post(ajaxurl, {
                    action: 'posh_push_test',
                    nonce: '<?php echo wp_create_nonce("posh_push_nonce"); ?>'
                }, function(response) {
                    if (response.success) {
                        resultEl.innerHTML = '<span style="color:green;">&#10003; Connected! Site ID: ' + (response.data?.data?.siteId || 'OK') + '</span>';
                    } else {
                        resultEl.innerHTML = '<span style="color:red;">&#10007; ' + (response.data?.message || 'Connection failed') + '</span>';
                    }
                }).fail(function() {
                    resultEl.innerHTML = '<span style="color:red;">&#10007; Request failed</span>';
                });
            });

            document.getElementById('posh-send-btn').addEventListener('click', function() {
                var resultEl = document.getElementById('posh-send-result');
                var title   = document.getElementById('posh-notif-title').value.trim();
                var message = document.getElementById('posh-notif-message').value.trim();
                var url     = document.getElementById('posh-notif-url').value.trim();

                if (!title || !message) {
                    resultEl.innerHTML = '<span style="color:red;">Title and message are required.</span>';
                    return;
                }

                resultEl.textContent = 'Sending...';
                jQuery.post(ajaxurl, {
                    action:  'posh_push_send',
                    nonce:   '<?php echo wp_create_nonce("posh_push_nonce"); ?>',
                    title:   title,
                    message: message,
                    url:     url,
                }, function(response) {
                    if (response.success) {
                        resultEl.innerHTML = '<span style="color:green;">&#10003; ' + response.data.message + '</span>';
                    } else {
                        resultEl.innerHTML = '<span style="color:red;">&#10007; ' + (response.data?.message || 'Failed') + '</span>';
                    }
                }).fail(function() {
                    resultEl.innerHTML = '<span style="color:red;">&#10007; Request failed</span>';
                });
            });
            </script>
        </div>
        <?php
    }

    public function renderSubscribersPage() {
        ?>
        <div class="wrap">
            <h1><?php _e('Subscribers', 'posh-push'); ?></h1>
            <p><?php _e('Manage your subscribers in the Posh Push dashboard.', 'posh-push'); ?></p>

            <?php
            $serverUrl = get_option('posh_push_server_url', 'http://localhost:3000');
            $dashboardUrl = rtrim($serverUrl, '/') . '/dashboard';
            ?>
            <a href="<?php echo esc_url($dashboardUrl); ?>" target="_blank" class="button button-primary">
                <?php _e('Open Posh Push Dashboard', 'posh-push'); ?>
            </a>
        </div>
        <?php
    }
}
