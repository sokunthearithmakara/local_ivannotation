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

use context_user;
use moodle_url;

/**
 * Dynamic form for adding/editing interactions content
 *
 * @package     local_ivannotation
 * @copyright   2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class media extends \core_form\dynamic_form {
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
        global $CFG, $USER;
        $usercontextid = context_user::instance($USER->id)->id;
        $data = new \stdClass();
        $data->id = $this->optional_param('id', 0, PARAM_INT);
        $data->contextid = $this->optional_param('contextid', null, PARAM_INT);
        $data->annotationid = $this->optional_param('annotationid', null, PARAM_INT);
        $data->start = $this->optional_param('start', null, PARAM_FLOAT);
        $data->end = $this->optional_param('end', null, PARAM_FLOAT);
        $data->type = $this->optional_param('type', null, PARAM_TEXT);
        $data->url = $this->optional_param('url', null, PARAM_URL);
        $data->alttext = $this->optional_param('alttext', null, PARAM_TEXT);
        require_once($CFG->libdir . '/filelib.php');
        // At least one file exists in draft area already.
        // We need to copy it to new draft area separately from other files of the same draft area.
        if ($data->url != '') {
            $urls = extract_draft_file_urls_from_text($data->url, false, $usercontextid, 'user', 'draft');
            $url = reset($urls);
            $filename = urldecode($url['filename']);
            $newdraftitemid = file_get_unused_draft_itemid();
            file_copy_file_to_file_area($url, $filename, $newdraftitemid);
        }

        $data->media = $newdraftitemid;
        $data->rounded = $this->optional_param('rounded', 0, PARAM_INT);
        $data->muted = $this->optional_param('muted', 0, PARAM_INT);
        $data->shadow = $this->optional_param('shadow', 0, PARAM_INT);
        $data->label = $this->optional_param('label', null, PARAM_TEXT);
        $data->gotourl = $this->optional_param('gotourl', null, PARAM_URL);
        $data->timestamp = $this->optional_param('timestamp', '', PARAM_TEXT);
        $data->freesize = $this->optional_param('freesize', 0, PARAM_INT);
        $data->size = $this->optional_param('size', 0, PARAM_INT);
        $data->vposition = $this->optional_param('vposition', 'bottom-right', PARAM_TEXT);
        $data->dismissable = $this->optional_param('dismissable', 0, PARAM_INT);
        $this->set_data($data);
    }

    /**
     * Processes dynamic submission
     *
     * @return \stdClass
     */
    public function process_dynamic_submission() {
        global $USER;
        $usercontextid = context_user::instance($USER->id)->id;

        $fromform = $this->get_data();
        $fromform->usercontextid = $usercontextid;
        // Get the draft file.
        if (!empty($fromform->media)) {
            $fs = get_file_storage();
            $files = $fs->get_area_files(
                $fromform->usercontextid,
                'user',
                'draft',
                $fromform->media,
                'filesize DESC',
            );
            $fromform->files = $files;
            $file = reset($files);
            if ($file) {
                $downloadurl = moodle_url::make_draftfile_url(
                    $file->get_itemid(),
                    $file->get_filepath(),
                    $file->get_filename()
                )->out();
                // Replace pluginfile with draftfile.
                $fromform->url = $downloadurl;
            } else {
                $fromform->url = new moodle_url('');
            }
        }
        $fromform->formattedalttext = format_string($fromform->alttext);
        $fromform->formattedlabel = format_string($fromform->label);
        return $fromform;
    }

    /**
     * Defines form elements
     */
    public function definition() {
        global $PAGE;
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

        $type = $this->optional_param('type', null, PARAM_TEXT);
        // HTML upload.
        $filemanageroptions = [
            'maxbytes'       => $PAGE->course->maxbytes,
            'subdirs'        => 0,
            'maxfiles'       => 1,
        ];

        if ($type == 'image') {
            $filemanageroptions['accepted_types'] = ['web_image'];
        } else if ($type == 'audio') {
            $filemanageroptions['accepted_types'] = ['.wav', '.mp4', '.m4a'];
        } else if ($type == 'video') {
            $filemanageroptions['accepted_types'] = ['.mp4'];
        }

        $mform->addElement('hidden', 'type', $type);

        $mform->addElement('text', 'label', get_string('label', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('label', PARAM_TEXT);
        $mform->hideIf('label', 'type', 'neq', 'file');

        $mform->addElement(
            'filemanager',
            'media',
            '<i class="bi bi-upload mx-2"></i>' . get_string($type . 'file', 'local_ivannotation'),
            null,
            $filemanageroptions
        );
        $mform->addRule('media', get_string('required'), 'required', null, 'client');

        $elementarray = [];
        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'muted',
            '',
            get_string('muted', 'local_ivannotation'),
            ['group' => 1],
            [0, 1]
        );

        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'rounded',
            '',
            get_string('rounded', 'local_ivannotation'),
            ['group' => 1],
            [0, 1]
        );

        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'shadow',
            '',
            get_string('shadow', 'local_ivannotation'),
            ['group' => 1],
            [0, 1]
        );

        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'freesize',
            '',
            get_string('freesize', 'local_ivannotation'),
            ['group' => 1],
            [0, 1]
        );
        $mform->hideIf('freesize', 'type', 'neq', 'video');

        $elementarray[] = $mform->createElement(
            'advcheckbox',
            'dismissable',
            '',
            get_string('dismissable', 'local_ivannotation'),
            ['group' => 1],
            [0, 1]
        );

        $mform->addGroup($elementarray, '', '');
        $mform->hideIf('rounded', 'type', 'in', ['audio']);
        $mform->hideIf('shadow', 'type', 'in', ['audio']);
        $mform->hideIf('muted', 'type', 'neq', 'video');
        $mform->hideIf('dismissable', 'type', 'neq', 'video');

        $mform->addElement('text', 'alttext', get_string('alttext', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('alttext', PARAM_TEXT);
        $mform->hideIf('alttext', 'type', 'neq', 'image');

        $mform->addElement('text', 'gotourl', get_string('gotourl', 'local_ivannotation'), ['size' => 100]);
        $mform->setType('gotourl', PARAM_URL);
        $mform->addRule(
            'gotourl',
            get_string('invalidurlformat', 'local_ivannotation'),
            'regex',
            "/\b(?:(?:https?|ftp):\/\/|www\.)[-a-z0-9+&@#\/%?=~_|!:,.;]*\.[a-z]{2,}[-a-z0-9+&@#\/%=~_|]*/i",
            'client'
        );
        $mform->hideIf('gotourl', 'type', 'neq', 'image');

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
        $mform->hideIf('timestampgroup', 'type', 'neq', 'image');

        $mform->addElement('select', 'size', get_string('size', 'local_ivannotation'), [
            '20' => '20%',
            '25' => '25%',
            '30' => '30%',
            '50' => '50%',
            '75' => '75%',
            '100' => '100%',
        ]);
        $mform->setDefault('size', '25');
        $mform->hideIf('size', 'type', 'neq', 'video');

        $mform->addElement('select', 'vposition', get_string('position', 'local_ivannotation'), [
            'top-left' => get_string('top-left', 'local_ivannotation'),
            'top-center' => get_string('top-center', 'local_ivannotation'),
            'top-right' => get_string('top-right', 'local_ivannotation'),
            'center-left' => get_string('center-left', 'local_ivannotation'),
            'center-center' => get_string('center-center', 'local_ivannotation'),
            'center-right' => get_string('center-right', 'local_ivannotation'),
            'bottom-left' => get_string('bottom-left', 'local_ivannotation'),
            'bottom-center' => get_string('bottom-center', 'local_ivannotation'),
            'bottom-right' => get_string('bottom-right', 'local_ivannotation'),
        ]);
        $mform->setDefault('vposition', 'bottom-right');
        $mform->hideIf('vposition', 'type', 'neq', 'video');

        $this->set_display_vertical();
    }

    /**
     * Validates form data
     *
     * @param array $data Form data
     * @param array $files Files
     * @return array
     */
    public function validation($data, $files) {
        $errors = [];
        if ($data['type'] == 'file' && empty($data['media'])) {
            $errors['media'] = get_string('required');
        }
        return $errors;
    }

    /**
     * Returns page URL for dynamic submission
     *
     * @return \moodle_url
     */
    protected function get_page_url_for_dynamic_submission(): \moodle_url {
        return new \moodle_url('/mod/interactivevideo/interactions.php', [
            'id' => $this->optional_param('annotationid', null, PARAM_INT),
        ]);
    }
}
