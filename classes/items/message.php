<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

namespace local_ivannotation\items;

/**
 * Class text
 *
 * @package    local_ivannotation
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class message extends \core_form\dynamic_form {
    /**
     * Returns form context
     *
     * If context depends on the form data, it is available in $this->_ajaxformdata or
     * by calling $this->optional_param()
     *
     * @return \context
     */
    protected function get_context_for_dynamic_submission(): \context {
        $contextid = $this->optional_param('contextid', null, PARAM_INT);
        return \context::instance_by_id($contextid, MUST_EXIST);
    }

    /**
     * Checks access for dynamic submission
     */
    protected function check_access_for_dynamic_submission(): void {
        require_capability('mod/interactivevideo:addinstance', $this->get_context_for_dynamic_submission());
    }

    /**
     * Sets data for dynamic submission
     */
    public function set_data_for_dynamic_submission(): void {
        $data = new \stdClass();
        $data->id = $this->optional_param('id', 0, PARAM_INT);
        $data->contextid = $this->optional_param('contextid', null, PARAM_INT);
        $data->annotationid = $this->optional_param('annotationid', null, PARAM_INT);
        $data->timestamp = $this->optional_param('timestamp', null, PARAM_TEXT);
        $data->start = $this->optional_param('start', null, PARAM_FLOAT);
        $data->end = $this->optional_param('end', null, PARAM_FLOAT);
        $data->title = $this->optional_param('title', null, PARAM_TEXT);
        $data->desc = $this->optional_param('desc', null, PARAM_TEXT);
        $data->viewport = $this->optional_param('viewport', 'window', PARAM_TEXT);
        $data->url = $this->optional_param('url', null, PARAM_URL);
        $data->icon = $this->optional_param('icon', null, PARAM_TEXT);
        $data->position = $this->optional_param('position', 'top', PARAM_TEXT);
        $data->color = $this->optional_param('color', 'dark', PARAM_TEXT);
        $this->set_data($data);
    }

    /**
     * Form definition
     */
    public function definition() {
        $mform = $this->_form;
        $mform->addElement('hidden', 'contextid', null);
        $mform->setType('contextid', PARAM_INT);
        $mform->addElement('hidden', 'id', 0);
        $mform->setType('id', PARAM_INT);
        $mform->addElement('hidden', 'annotationid', 0);
        $mform->setType('annotationid', PARAM_INT);
        $mform->addElement('hidden', 'start', null);
        $mform->setType('start', PARAM_FLOAT);
        $mform->addElement('hidden', 'end', null);
        $mform->setType('end', PARAM_FLOAT);

        $mform->addElement('html', '<div class="alert alert-info">' . get_string('messagedesc', 'local_ivannotation') . '</div>');

        // Title.
        $mform->addElement('text', 'title', get_string('title', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('title', PARAM_TEXT);

        // Label.
        $mform->addElement('textarea', 'desc', get_string('text', 'local_ivannotation'), [
            'rows' => 3,
            'cols' => 100,
        ]);
        $mform->setType('desc', PARAM_TEXT);
        $mform->addRule('desc', get_string('required'), 'required', null, 'client');

        // Icon.
        $mform->addElement('text', 'icon', get_string('icon', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('icon', PARAM_TEXT);
        $mform->addHelpButton('icon', 'icon', 'local_ivannotation');

        // URL.
        $mform->addElement('text', 'url', get_string('url', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('url', PARAM_URL);
        $mform->addRule(
            'url',
            get_string('invalidurlformat', 'local_ivannotation'),
            'regex',
            "/\b(?:(?:https?|ftp):\/\/|www\.)[-a-z0-9+&@#\/%?=~_|!:,.;]*\.[a-z]{2,}[-a-z0-9+&@#\/%=~_|]*/i",
            'client'
        );

        // Position.
        $mform->addElement('select', 'position', get_string('position', 'local_ivannotation'), [
            'top' => get_string('top', 'local_ivannotation'),
            'bottom' => get_string('bottom', 'local_ivannotation'),
            'top-right' => get_string('topright', 'local_ivannotation'),
            'top-left' => get_string('topleft', 'local_ivannotation'),
            'bottom-right' => get_string('bottomright', 'local_ivannotation'),
            'bottom-left' => get_string('bottomleft', 'local_ivannotation'),
        ]);
        $mform->setDefault('position', 'top');
        $mform->setType('position', PARAM_TEXT);

        // Viewport.
        $mform->addElement('select', 'viewport', get_string('viewport', 'local_ivannotation'), [
            'window' => get_string('window', 'local_ivannotation'),
            'video' => get_string('video', 'local_ivannotation'),
        ]);
        $mform->setDefault('viewport', 'window');

        // Color.
        $mform->addElement('select', 'color', get_string('color', 'local_ivannotation'), [
            'dark' => get_string('dark', 'local_ivannotation'),
            'light' => get_string('light', 'local_ivannotation'),
        ]);
        $mform->setDefault('color', 'dark');
        $mform->setType('color', PARAM_TEXT);

        $this->set_display_vertical();
    }

    /**
     * Processes dynamic submission
     * @return object
     */
    public function process_dynamic_submission() {
        $fromform = $this->get_data();
        $fromform->formattedtitle = format_string($fromform->title);
        $fromform->formatteddesc = format_text($fromform->desc, FORMAT_PLAIN);
        return $fromform;
    }

    /**
     * Validates form data
     * @param array $data
     * @param array $files
     * @return array
     */
    public function validation($data, $files) {
        $errors = [];
        return $errors;
    }

    /**
     * Returns page URL for dynamic submission
     * @return \moodle_url
     */
    protected function get_page_url_for_dynamic_submission(): \moodle_url {
        return new \moodle_url('/mod/interactivevideo/interactions.php', [
            'id' => $this->optional_param('annotationid', null, PARAM_INT),
        ]);
    }
}
