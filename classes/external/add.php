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

namespace local_ivannotation\external;

use external_function_parameters;
use external_single_structure;
use external_api;
use external_value;

defined('MOODLE_INTERNAL') || die;

require_once($CFG->libdir . '/externallib.php');
/**
 * Class add
 *
 * @package    local_ivannotation
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class add extends external_api {

    /**
     * Describes the parameters for local_ivannotation_add
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'annotationdata' => new external_value(PARAM_TEXT, 'The data of the annotation'),
        ]);
    }

    /**
     * Implementation of web service local_ivannotation_add
     *
     * @param string $annotationdata The data of the annotation
     * @return array
     */
    public static function execute($annotationdata) {
        global $DB;
        // Parameter validation.
        $params = self::validate_parameters(self::execute_parameters(), [
            'annotationdata' => $annotationdata,
        ]);

        require_login();

        $data = json_decode($annotationdata, true);
        $courseid = $data['courseid'];
        $defaults = $DB->get_record(
            'interactivevideo_defaults',
            ['courseid' => $courseid, 'type' => 'annotation'],
            '*',
            IGNORE_MISSING
        );
        if ($defaults) {
            foreach ($defaults as $key => $value) {
                $data[$key] = $value;
            }
        }
        $data['courseid'] = $courseid;
        $data['timestamp'] = -1; // Default timestamp for analytics.
        $data['type'] = 'annotation';
        $data['content'] = ''; // Default content for annotation.
        $data['timecreated'] = time();
        $data['timemodified'] = time();
        $data['id'] = $DB->insert_record('interactivevideo_items', (object)$data);
        $data['formattedtitle'] = get_string('pluginname', 'local_ivannotation');
        return [
            'data' => json_encode($data),
        ];
    }

    /**
     * Describes the return value for local_ivannotation_add
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'data' => new external_value(PARAM_TEXT, 'The data of the annotation'),
        ]);
    }
}
