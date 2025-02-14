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
 * Class navigation
 *
 * @package    local_ivannotation
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class navigation extends \core_form\dynamic_form {
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
        $data->start = $this->optional_param('start', null, PARAM_FLOAT);
        $data->end = $this->optional_param('end', null, PARAM_FLOAT);
        $data->label = $this->optional_param('label', null, PARAM_TEXT);
        $data->timestamp = $this->optional_param('timestamp', null, PARAM_TEXT);
        $data->style = $this->optional_param('style', null, PARAM_TEXT);
        $data->rounded = $this->optional_param('rounded', null, PARAM_INT);
        $data->shadow = $this->optional_param('shadow', 0, PARAM_INT);
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
        $mform->addElement('text', 'label', get_string('label', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('label', PARAM_TEXT);
        $mform->addRule('label', get_string('required'), 'required', null, 'client');

        $element = [];
        $element[] = $mform->createElement(
            'text',
            'timestamp',
            '',
            [
                'size' => 25,
                'class' => 'timestamp-input',
                'readonly' => 'readonly',
                'placeholder' => '00:00:00',
            ]
        );
        $mform->setType('timestamp', PARAM_TEXT);
        $element[] = $mform->createElement('button', 'pickatime', '<i class="bi bi-stopwatch"></i>', [
            'class' => 'pickatime',
            'title' => get_string('pickatime', 'ivplugin_contentbank'),
            'data-field' => 'timestamp',
        ]);
        $element[] = $mform->createElement('button', 'resettime', '<i class="bi bi-trash3 text-danger"></i>', [
            'class' => 'resettime',
            'title' => get_string('resettime', 'ivplugin_contentbank'),
            'data-field' => 'timestamp',
        ]);
        $mform->addGroup($element, 'timestampgroup', get_string('gototimestamp', 'local_ivannotation'), '', false);
        $mform->addGroupRule('timestampgroup', ['timestamp' => [
            [get_string('required'), 'required', 'client'],
        ]]);
        $mform->addElement('select', 'style', get_string('style', 'local_ivannotation'), [
            'btn-danger' => get_string('danger', 'local_ivannotation'),
            'btn-warning' => get_string('warning', 'local_ivannotation'),
            'btn-success' => get_string('success', 'local_ivannotation'),
            'btn-primary' => get_string('primary', 'local_ivannotation'),
            'btn-secondary' => get_string('secondary', 'local_ivannotation'),
            'btn-info' => get_string('info', 'local_ivannotation'),
            'btn-light' => get_string('light', 'local_ivannotation'),
            'btn-dark' => get_string('dark', 'local_ivannotation'),
            'btn-outline-danger' => get_string('dangeroutline', 'local_ivannotation'),
            'btn-outline-warning' => get_string('warningoutline', 'local_ivannotation'),
            'btn-outline-success' => get_string('successoutline', 'local_ivannotation'),
            'btn-outline-primary' => get_string('primaryoutline', 'local_ivannotation'),
            'btn-outline-secondary' => get_string('secondaryoutline', 'local_ivannotation'),
            'btn-outline-info' => get_string('infooutline', 'local_ivannotation'),
            'btn-outline-light' => get_string('lightoutline', 'local_ivannotation'),
            'btn-outline-dark' => get_string('darkoutline', 'local_ivannotation'),
            'btn-transparent' => get_string('transparent', 'local_ivannotation'),
        ]);

        $elementarray = [];
        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'rounded',
            '',
            get_string('rounded', 'local_ivannotation'),
            ["group" => 1],
            [0, 1]
        );

        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'shadow',
            '',
            get_string('shadow', 'local_ivannotation'),
            ["group" => 1],
            [0, 1]
        );

        $mform->addGroup($elementarray, '', '');

        $this->set_display_vertical();
    }

    /**
     * Processes dynamic submission
     * @return object
     */
    public function process_dynamic_submission() {
        $fromform = $this->get_data();
        $fromform->formattedlabel = format_string($fromform->label);
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
