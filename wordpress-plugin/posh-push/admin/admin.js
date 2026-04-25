/**
 * Posh Push Admin JavaScript
 * ==========================
 * Handles AJAX interactions on the plugin settings page:
 *   - Test Connection button
 *   - Send Manual Notification button
 */
/* global jQuery, poshPushAdmin */

(function ($) {
  'use strict';

  // ── Test connection ──────────────────────────────────────────────────────

  $('#posh-test-connection').on('click', function () {
    const $btn = $(this);
    const $result = $('#posh-test-result');

    $btn.prop('disabled', true).text('Testing…');
    $result.text('').css('color', '');

    $.post(
      poshPushAdmin.ajaxUrl,
      {
        action: 'posh_push_test_connection',
        nonce: poshPushAdmin.nonce,
      },
      function (res) {
        if (res.success) {
          $result.text('✓ ' + res.data.message).css('color', '#46b450');
        } else {
          $result.text('✗ ' + (res.data.message || 'Connection failed.')).css('color', '#dc3232');
        }
      }
    ).always(function () {
      $btn.prop('disabled', false).text('Test Connection');
    });
  });

  // ── Manual send ──────────────────────────────────────────────────────────

  $('#posh-send-manual').on('click', function () {
    const $btn = $(this);
    const $result = $('#posh-send-result');

    const title = $('#posh-manual-title').val().trim();
    const message = $('#posh-manual-message').val().trim();
    const url = $('#posh-manual-url').val().trim();

    if (!title || !message) {
      $result.text('Title and message are required.').css('color', '#dc3232');
      return;
    }

    $btn.prop('disabled', true).text('Sending…');
    $result.text('').css('color', '');

    $.post(
      poshPushAdmin.ajaxUrl,
      {
        action: 'posh_push_send_manual',
        nonce: poshPushAdmin.nonce,
        title: title,
        message: message,
        url: url,
      },
      function (res) {
        if (res.success) {
          $result.text('✓ ' + res.data.message).css('color', '#46b450');
          // Clear fields on success
          $('#posh-manual-title, #posh-manual-message').val('');
        } else {
          $result.text('✗ ' + (res.data.message || 'Send failed.')).css('color', '#dc3232');
        }
      }
    ).always(function () {
      $btn.prop('disabled', false).text('Send Notification');
    });
  });

})(jQuery);
