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

namespace local_ivannotation;

/**
 * Class main
 *
 * @package    local_ivannotation
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class main extends \ivplugin_richtext\main {
    /**
     * Get the property.
     */
    public function get_property() {
        return [
            'name' => 'annotation',
            'title' => get_string('pluginname', 'local_ivannotation'),
            'icon' => 'bi bi-pip',
            'amdmodule' => 'local_ivannotation/main',
            'class' => 'local_ivannotation\\main',
            'form' => 'local_ivannotation\\form',
            'hascompletion' => false,
            'hastimestamp' => false,
            'hasreport' => false,
            'allowmultiple' => false,
            'description' => get_string('plugindescription', 'local_ivannotation'),
            'author' => 'tsmakara',
            'authorlink' => 'mailto:sokunthearithmakara@gmail.com',
            'tutorial' => get_string('tutorialurl', 'local_ivannotation'),
            'stringcomponent' => 'local_ivannotation',
        ];
    }

    /**
     * Get the content.
     *
     * @param array $arg The arguments.
     * @return string The content.
     */
    public function get_content($arg) {
        global $CFG, $PAGE;
        $context = \context::instance_by_id($arg["contextid"]);
        $PAGE->set_context($context);
        $content = $arg["content"];
        $id = $arg["id"];
        $contextid = $arg["contextid"];
        $editmode = $arg["editmode"];
        // Process the content from editor for displaying.
        require_once($CFG->libdir . '/filelib.php');
        if ($editmode) {
            // Load the file in the draft area. mod_interactivevideo, content.
            $draftitemid = file_get_submitted_draft_itemid('content');
            $content = file_prepare_draft_area(
                $draftitemid,
                $contextid,
                'mod_interactivevideo',
                'content',
                $id,
                [
                    'maxfiles' => -1,
                    'maxbytes' => 0,
                    'trusttext' => true,
                    'noclean' => true,
                    'context' => $context,
                ],
                $content
            );
        } else {
            // Load the file from the draft area.
            $content = file_rewrite_pluginfile_urls($content, 'pluginfile.php', $contextid, 'mod_interactivevideo', 'content', $id);
        }

        if ($content) {
            // Parse the content to get the items that need formatting.
            $items = json_decode($content);
            $items = array_map(function ($item) {
                if ($item->type == "text" || $item->type == "textblock" || $item->type == "navigation" || $item->type == "file") {
                    $item->properties->formattedlabel = format_string($item->properties->label);
                } else if ($item->type == "image") {
                    $item->properties->formattedalttext = format_string($item->properties->alttext);
                } else if ($item->type == "hotspot") {
                    $item->properties->formattedtitle = format_string($item->properties->title);
                    $item->properties->content->text = html_entity_decode(
                        $item->properties->content->text,
                        ENT_QUOTES | ENT_SUBSTITUTE
                    );
                }
                return $item;
            }, $items);
            $content = json_encode($items);
        }
        return json_encode([
            'draftitemid' => $draftitemid,
            'items' => $content,
        ]);
    }
}
