<?php
/**
 * Proxies inquiry form submissions to WordPress Contact Form 7 on tka.rs.
 * Required because CF7 uses dynamic honeypot tokens.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

const CF7_ENDPOINT = 'https://www.tka.rs/wp-json/contact-form-7/v1/contact-forms/10533/feedback';
const HOME_URL = 'https://www.tka.rs/';

function fetch_honeypot_tokens(): array
{
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 15,
            'header' => "User-Agent: TKA-Inquiry-Proxy/1.0\r\n",
        ],
    ]);

    $html = @file_get_contents(HOME_URL, false, $ctx);
    if ($html === false) {
        return [];
    }

    $tokens = [];

    if (preg_match('/wpa_field_info\s*=\s*(\{[^}]+\})/', $html, $m)) {
        $info = json_decode($m[1], true);
        if (is_array($info) && !empty($info['wpa_field_name'])) {
            $tokens[$info['wpa_field_name']] = (string) ($info['wpa_field_value'] ?? '');
        }
    }

    if (preg_match('/name="_wpcf7_ak_js"\s+value="(\d+)"/', $html, $m)) {
        $tokens['_wpcf7_ak_js'] = $m[1];
    }

    $tokens['_wpcf7_ak_hp_textarea'] = '';

    return $tokens;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$honeypot = fetch_honeypot_tokens();
$fields = array_merge($honeypot, $input);

// CF7 required hidden fields
$fields['_wpcf7'] = '10533';
$fields['_wpcf7_version'] = '6.0.4';
$fields['_wpcf7_locale'] = 'en_US';
$fields['_wpcf7_unit_tag'] = 'wpcf7-f10533-p11123-o1';
$fields['_wpcf7_container_post'] = '11123';

// Pad required fields from inactive CF7 groups (conditional plugin not applied via REST)
$pad = [
    'origin-destination' => '-',
    'vehicle-type' => '-',
    'specific-customs-type' => '-',
    'volume' => '-',
    'dimensions' => '-',
];

foreach ($pad as $key => $value) {
    if (empty($fields[$key])) {
        $fields[$key] = $value;
    }
}

$body = [];
foreach ($fields as $key => $value) {
    if (is_array($value)) {
        foreach ($value as $v) {
            $body[] = urlencode($key) . '[]=' . urlencode((string) $v);
        }
    } else {
        $body[] = urlencode($key) . '=' . urlencode((string) $value);
    }
}

$payload = implode('&', $body);

$ctx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: TKA-Inquiry-Proxy/1.0\r\n",
        'content' => $payload,
        'timeout' => 30,
    ],
]);

$response = @file_get_contents(CF7_ENDPOINT, false, $ctx);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['status' => 'error', 'message' => 'Could not reach tka.rs form endpoint.']);
    exit;
}

http_response_code(200);
echo $response;
