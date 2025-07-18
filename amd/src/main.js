
/* eslint-disable complexity */
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

/**
 * Main script for the annotation plugin
 *
 * @module     local_ivannotation/main
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import Base from 'mod_interactivevideo/type/base';
import Ajax from 'core/ajax';
import Templates from 'core/templates';
import ModalForm from 'core_form/modalform';
import {notifyFilterContentUpdated as notifyFilter} from 'core_filters/events';
import Notification from 'core/notification';

export default class Annotation extends Base {
    /**
     * Round a number to two decimal places
     * @param {Number} num Number
     * @returns {Number} rounded number
     */
    roundToTwo(num) {
        return +(Math.round(num + 'e+2') + 'e-2');
    }

    /**
     * Initialize the annotation type
     * @returns {void}
     */
    async init() {
        const videoWrapper = $('#video-wrapper');
        let self = this;
        let item = this.annotations.find((annotation) => annotation.type == 'annotation');
        if (!this.isEditMode()) {
            if (!item || item.content == '') {
                return;
            }
            const updateAspectRatio = async(video, reset) => {
                let elem = video ? $('#player') : $(`#annotation-canvas[data-id='${item.id}']`);
                if ($("#wrapper").hasClass('fullscreen')) {
                    let ratio = 16 / 9; // #player aspect ratio.
                    if (!this.displayoptions.usefixedratio || this.displayoptions.usefixedratio == 0) {
                        ratio = this.player.aspectratio;
                    }
                    let videowrapperaspect = videoWrapper.width() / videoWrapper.height();
                    const videowrapperwidth = videoWrapper.width();
                    const videowrapperheight = videoWrapper.height();
                    // Screen is wider than the video.
                    if (videowrapperaspect > ratio) {
                        let height = videowrapperheight;
                        let width = height * ratio;
                        elem.css('height', height + 'px');
                        elem.css('width', width + 'px');
                        elem.css('top', '0');
                        elem.css('left', (videowrapperwidth - width) / 2 + 'px');
                    } else if (videowrapperaspect < ratio) {
                        let width = videowrapperwidth;
                        let height = width / ratio;
                        elem.css('width', width + 'px');
                        elem.css('height', height + 'px');
                        elem.css('top', ((videowrapperheight - height) / 2) + 'px');
                        elem.css('left', '0');
                    }
                } else {
                    elem.css('width', '100%');
                    elem.css('height', '100%');
                    elem.css('top', '0');
                    elem.css('left', '0');
                }
                if (reset) {
                    elem.css('width', '100%');
                    elem.css('height', '100%');
                    elem.css('top', '0');
                    elem.css('left', '0');
                }
            };

            updateAspectRatio();
            updateAspectRatio(true);

            let vwrapper = document.querySelector('#video-wrapper');
            let resizeTimeout;
            let resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    updateAspectRatio();
                    updateAspectRatio(true);
                }, 100);
            });
            resizeObserver.observe(vwrapper);

            $(document).on('timeupdate', function() {
                updateAspectRatio(true, true);
            });

            $('#annotation-canvas').attr('data-id', item.id);
            let content = await this.render(item, 'json');
            await this.postContentRender(item, content);
        } else {
            if (item) {
                $('#annotation-canvas').attr('data-id', item.id);
                item.editmode = true;
                let content = await this.render(item, 'json');
                await this.postContentRender(item, content);
            }
        }

        $('#annotation-canvas .dismiss-btn').off('click').on('click', function() {
            $(this).closest('.annotation-wrapper').remove();
        });

        let annos = $('#annotation-canvas .annotation-wrapper');
        annos = annos.map(function() {
            return {
                self: $(this),
                id: $(this).data('item'),
                start: Number($(this).data('start')),
                end: Number($(this).data('end')),
                type: $(this).data('type'),
                duration: Number($(this).data('duration')) || 0,
                video: $(this).find('video, audio')[0],
            };
        }).get();

        // Update annos on annotationChanged event
        $(document).on('annotationChanged.Annotation', async function() {
            annos = $('#annotation-canvas .annotation-wrapper');
            annos = annos.map(function() {
                let video = $(this).find('video, audio')[0];
                if (video) {
                    video.pause();
                }
                return {
                    self: $(this),
                    id: $(this).data('item'),
                    start: Number($(this).data('start')),
                    end: Number($(this).data('end')),
                    type: $(this).data('type'),
                    duration: Number($(this).data('duration')) || 0,
                    video: video,
                };
            }).get();

            self.dispatchEvent('timeupdate', {time: await self.player.getCurrentTime()});
        });

        $(document).on('iv:playerReload.Annotation', async function(e) {
            if (e.originalEvent.detail.main) { // If this is the main video.
                annos = $('#annotation-canvas .annotation-wrapper');
                annos = annos.map(function() {
                    let video = $(this).find('video, audio')[0];
                    if (video) {
                        video.pause();
                    }
                    return {
                        self: $(this),
                        id: $(this).data('item'),
                        start: Number($(this).data('start')),
                        end: Number($(this).data('end')),
                        type: $(this).data('type'),
                        duration: Number($(this).data('duration')) || 0,
                        video: video,
                    };
                }).get();
            } else {
                annos = annos.map(x => {
                    x.start = self.start;
                    x.end = self.start;
                    return x;
                });
            }
            self.dispatchEvent('timeupdate', {time: await self.player.getCurrentTime()});
        });

        $(document).on('timeupdate.Annotation', async function(e) {
            if (annos.length == 0) {
                return;
            }
            let t = e.originalEvent.detail.time;
            let hasMute = false;

            // Filter the annos based on the current time.
            let visibles = annos.filter(x => t >= x.start && t <= x.end);
            let hiddens = annos.filter(x => t < x.start || t > x.end);
            let toShow = visibles.filter(x => !x.activated);
            let toHide = hiddens.filter(x => !x.activated);

            // At the beginning, activated isn't available yet.
            if (annos[0].activated == undefined) {
                toShow = visibles;
                toHide = hiddens;
            }

            toShow.map(async(x) => {
                x.self.css('visibility', 'visible');
                let isPaused = await self.player.isPaused();
                if (x.type == 'video' || x.type == 'audio') {
                    let video = x.video;
                    if (video) {
                        if (isPaused) {
                            video.pause();
                        } else {
                            video.play();
                        }
                    }
                }
                return x.id;
            });

            toHide.map(x => {
                x.self.css('visibility', 'hidden');
                if (x.type == 'video' || x.type == 'audio') {
                    let video = x.video;
                    if (video) {
                        video.pause();
                    }
                }
                return x.id;
            });

            annos.forEach(async function(anno) {
                if (anno.type == 'mute') { // If mute exists.
                    hasMute = true;
                }
                if (toHide.includes(anno.id)) {
                    anno.activated = false;
                }
                if (toShow.includes(anno.id)) {
                    anno.activated = true;
                }
            });

            if (!hasMute) {
                return;
            }

            // Check if there is any active mute item. This is done so because we don't want to call isMuted() on every frame.
            let muteElem = annos.filter(x => x.type == 'mute' && x.start <= t && x.end >= t); // If mute is active.
            let isMuted = await self.player.isMuted();
            if (muteElem.length > 0 && !isMuted) {
                self.player.mute();
            } else if (muteElem.length === 0 && isMuted) {
                self.player.unMute();
            }
        });

        // Handle speed change.
        $(document).off('iv:playerRateChange.Annotations').on('iv:playerRateChange.Annotations', function(e) {
            let rate = e.detail.rate;
            let videos = annos.filter(x => x.video);
            videos.forEach(x => {
                x.video.playbackRate = rate;
            });
        });

        // Event listener to pause all the videos when the player is paused or ended.
        $(document).on('videoPaused.Annotations iv:playerPaused.Annotations iv:playerEnded.Annotations', function() {
            let videos = annos.filter(x => x.video);
            videos.forEach(x => x.video.pause());
        });

        $(document).off('iv:playerSeek.Annotation').on('iv:playerSeek.Annotation', async function() {
            let currentTime = await self.player.getCurrentTime();
            let videos = annos.filter(x => x.video && x.start <= currentTime && x.end >= currentTime);
            videos.forEach(x => {
                x.video.currentTime = currentTime - x.start;
            });
        });
    }

    /**
     * Render the annotation toolbar
     * @param {Object} annotation annotation object
     * @returns {void}
     */
    async renderAnnotationToolbar(annotation) {
        $('#annotation-btns').remove();
        let annotationitems = [
            {
                'icon': 'bi bi-image',
                'type': 'media',
                'mediatype': 'image',
                'label': M.util.get_string('image', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-film',
                'type': 'media',
                'mediatype': 'video',
                'label': M.util.get_string('video', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-volume-up',
                'type': 'media',
                'mediatype': 'audio',
                'label': M.util.get_string('audio', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-volume-mute',
                'type': 'mute',
                'mediatype': 'mute',
                'label': M.util.get_string('mute', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-alphabet-uppercase',
                'type': 'textblock',
                'mediatype': 'textblock',
                'label': M.util.get_string('text', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-circle-square',
                'type': 'shape',
                'mediatype': 'shape',
                'label': M.util.get_string('shape', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-file-earmark-arrow-down',
                'type': 'media',
                'mediatype': 'file',
                'label': M.util.get_string('inlinefile', 'local_ivannotation'),
            },
            {
                'icon': 'bi bi-sign-turn-right',
                'type': 'navigation',
                'mediatype': 'navigation',
                'label': M.util.get_string('navigation', 'local_ivannotation')
            },
            {
                'icon': 'bi bi-plus-circle',
                'type': 'hotspot',
                'mediatype': 'hotspot',
                'label': M.util.get_string('hotspot', 'local_ivannotation'),
            },

        ];
        const dataForTemplate = {
            id: annotation.id,
            items: annotationitems,
        };

        let html = await Templates.render('local_ivannotation/toolbar', dataForTemplate);
        $("#wrapper").append(html);

        this.enableColorPicker();
    }

    /**
     * Callback after the content is retrieved
     * @param {Object} annotation annotation object
     * @param {Object} data data processed through the main php file
     */
    async postContentRender(annotation, data) {
        let self = this;
        let $videoWrapper = $('#annotation-canvas');

        // Put a background so that when an annotation is selected, user is prevented from clicking on the video.
        if (self.isEditMode()) {
            $videoWrapper.append(`<div id="background" class="position-absolute w-100 h-100 bg-transparent d-none"></div>`);
        }
        let $playerWrapper = $('#wrapper');
        let draftStatus = null;

        /**
         * Format seconds to HH:MM:SS
         * @param {Number} seconds seconds
         * @param {Boolean} rounded if the seconds should be rounded
         * @returns formatted time
         */
        const convertSecondsToMMSS = (seconds, rounded = false) => {
            let hours = Math.floor(seconds / 3600);
            let minutes = Math.floor((seconds - hours * 3600) / 60);
            let sec = seconds - hours * 3600 - minutes * 60;
            let formattedTime = '';
            if (hours > 0) {
                formattedTime += hours + ':';
            }
            if (minutes < 10) {
                formattedTime += '0';
            }
            formattedTime += minutes + ':';
            if (sec < 10) {
                formattedTime += '0';
            }
            if (rounded) {
                formattedTime += Math.round(sec);
            } else {
                formattedTime += self.roundToTwo(sec);
            }
            return formattedTime;
        };

        /**
         * Update position information of the active element on the toolbar.
         * @param {Object} elem jQuery element
         */
        const updatePositionInfo = (elem) => {
            let w = elem.outerWidth();
            let hw = elem.outerHeight();
            let t = elem.position().top < 0 ? 0 : elem.position().top;
            let l = elem.position().left < 0 ? 0 : elem.position().left;
            let z = elem.css('z-index');
            let s = elem.data('start');
            let e = elem.data('end');
            let $position = $('#annotation-btns #position');
            $position.find('#x-position').text(Math.round(l));
            $position.find('#y-position').text(Math.round(t));
            $position.find('#z-position').text(z - 5);
            $position.find('#w-position').text(Math.round(w));
            $position.find('#h-position').text(Math.round(hw));
            $position.find('#s-position').text(convertSecondsToMMSS(s));
            $position.find('#e-position').text(convertSecondsToMMSS(e));
        };

        /**
         * Recalculate the size of the element.
         * @param {Object} elem jQuery element
         * @return {Object} position of the element
         */
        const recalculatingSize = (elem) => {
            let message = $('#annotation-canvas');
            let w = elem.outerWidth() / message.width() * 100;
            let h = elem.outerHeight() / message.height() * 100;
            let t = elem.position().top / message.height() * 100;
            t = t < 0 ? 0 : t;
            let l = elem.position().left / message.width() * 100;
            l = l < 0 ? 0 : l;
            let z = elem.css('z-index');
            let g = elem.data('group');
            let position = {
                'width': w + '%',
                'height': h + '%',
                'left': l + '%',
                'top': t + '%',
                'z-index': z,
            };
            position.group = g;
            elem.css(position);
            updatePositionInfo(elem);
            return position;
        };

        /**
         * Calculate the text size for text and file type.
         * @param {Object} elem jQuery element
         * @param {Boolean} button if it is a button
         * @param {Boolean} multiline if it is a multiline text
         */
        const recalculatingTextSize = (elem, button, multiline = false) => {
            let fontSize = elem.outerHeight();
            let padding = 0;
            let rowCount = 1;
            if (multiline) {
                let rows = elem.find('.text-row');
                rowCount = rows.length;
                if (rowCount > 1) {
                    let rowHeight = elem.outerHeight() / rowCount;
                    padding = rowHeight * 0.3;
                    fontSize = (elem.outerHeight() - padding * 2) / rowCount;
                }
            }
            let style = {
                'font-size': (button ? fontSize * 0.7 : fontSize * 0.9) + 'px',
                'line-height': fontSize + 'px',
                'padding-left': (button ? fontSize * 0.5 : fontSize * 0.3) + 'px',
                'padding-right': (button ? fontSize * 0.5 : fontSize * 0.3) + 'px',
            };
            if (multiline && rowCount > 1) {
                style.padding = padding + 'px';
            }
            elem.find('.annotation-content').css(style);
            elem.css('width', 'auto');
        };

        /**
         * Render timeline items.
         * @param {Array} elements array of elements to render
         * @param {Number} activeids array of ids of active elements
         */
        const renderTimelineItems = async(elements, activeids) => {
            const currentTime = await self.player.getCurrentTime();
            if (activeids === null) {
                activeids = [];
            } else {
                activeids = activeids.map(id => parseInt(id));
            }
            let timeline = $('#timeline #annotation-timeline');
            timeline.empty();
            elements.sort((a, b) => b.position['z-index'] - a.position['z-index']);
            let count = 0;
            let timelineHTML = '';
            elements.forEach((item, i) => {
                let prop = item.properties;
                let type = item.type;
                let id = parseInt(item.id);
                let left = (prop.start - self.start) / (self.end - self.start) * 100;
                let width = (prop.end - prop.start) / (self.end - self.start) * 100;
                timelineHTML += `<div class="annotation-timeline-item position-absolute ${activeids.includes(id) ? 'active' : ''}"
                     data-item="${id}" data-type="${type}" data-end="${prop.end}" data-start="${prop.start}"
                     data-duration="${prop.duration}"
                         style="z-index: 5; left: ${left}%; top: ${(i + 1) * 10}px; width: ${width}%">
                         <div class="annotation-timeline-item-content">
                            ${M.util.get_string(type, 'local_ivannotation')}
                            </div>
                         </div>`;
                count++;
                if (count == elements.length) {
                    timeline.append(timelineHTML);
                    // Initialize the draggable and resizable for each item on the timeline.
                    $('.annotation-timeline-item').draggable({
                        'axis': 'x',
                        'containment': '#annotation-timeline',
                        'cursor': 'move',
                        'grid': [1, 0],
                        'start': function() {
                            // Get all the selected elements.
                            if (!$(this).hasClass('active')) {
                                $(this).trigger('click');
                            }
                            let $selected = $('.annotation-timeline-item.active');
                            $selected.addClass('no-pointer-events');
                            $selected.each(function() {
                                $(this).data('startPosition', $(this).position());
                            });
                            timestampScrollbar($(this).data('start'));
                            $('#timeline-items').addClass('no-pointer-events');
                        },
                        'drag': async function(e, ui) {
                            let timestamp = (ui.position.left) / $('#annotation-timeline').width() * self.totaltime
                                + self.start;
                            let duration = $(this).data('end') - $(this).data('start');
                            $('#s-position').text(convertSecondsToMMSS(timestamp));
                            $('#e-position').text(convertSecondsToMMSS(timestamp + duration));

                            // Hide or show these element
                            let now = await self.player.getCurrentTime();
                            let $annowrapper = $videoWrapper.find(`.annotation-wrapper[data-item="${$(this).data('item')}"]`);
                            if (timestamp <= now && timestamp + duration >= now) {
                                $annowrapper.css('visibility', 'visible');
                            } else {
                                $annowrapper.css('visibility', 'hidden');
                            }
                            let left = (timestamp - self.start) / self.totaltime * 100;
                            $('#cursorbar').css('left', `calc(${left}% + 5px)`);
                            $('#position-marker').css('left', `${left}%`);
                            $('#vseek #bar #position').text(convertSecondsToMMSS(timestamp));

                            let $selected = $('.annotation-timeline-item.active');
                            const distance = ui.originalPosition.left - ui.position.left;
                            $selected.not(this).each(function() {
                                let $this = $(this);
                                const position = $this.data('startPosition');
                                $this.css({
                                    left: ((position.left - distance) / $('#annotation-timeline').width()) * 100 + '%',
                                });
                                let timestamp = ($this.position().left / $('#annotation-timeline').width()) * self.totaltime
                                    + self.start;
                                let duration = $this.data('end') - $this.data('start');
                                let $annowrapper = $videoWrapper.find(`.annotation-wrapper[data-item="${$this.data('item')}"]`);
                                if (timestamp <= now && timestamp + duration >= now) {
                                    $annowrapper.css('visibility', 'visible');
                                } else {
                                    $annowrapper.css('visibility', 'hidden');
                                }
                            });
                        },
                        'stop': function() {
                            setTimeout(function() {
                                $('#cursorbar, #position-marker').remove();
                                $('#timeline-items').removeClass('no-pointer-events');
                                $(this).removeClass('no-pointer-events');
                            }, 200);
                            let $selected = $('.annotation-timeline-item.active');
                            $selected.each(function() {
                                let $this = $(this);
                                let elementid = $this.data('item');
                                let itemIndex = items.findIndex(x => x.id == elementid);
                                let item = items[itemIndex];
                                let elem = $videoWrapper.find(`.annotation-wrapper[data-item="${elementid}"]`);
                                let prop = item.properties;
                                let duration = prop.end - prop.start;
                                prop.start = (($this.position().left) / $('#annotation-timeline').width() * self.totaltime)
                                    + self.start;
                                prop.start = self.roundToTwo(prop.start);
                                prop.end = prop.start + duration;
                                elem.attr('data-start', prop.start);
                                elem.attr('data-end', prop.end);
                                $this.attr('data-start', prop.start);
                                $this.attr('data-end', prop.end);
                                item.properties = prop;
                                items[itemIndex] = item;
                            });
                            $selected = $selected.map(function() {
                                return $(this).data('item');
                            }).get();
                            saveTracking($selected);
                            renderItems(items, $selected, false);
                        },
                    });

                    $('.annotation-timeline-item').resizable({
                        'handles': 'e, w',
                        'containment': 'parent',
                        'grid': [1, 0],
                        'start': async function() {
                            // Get all the selected elements
                            if (!$(this).hasClass('active')) {
                                $(this).trigger('click');
                            }
                            let $selected = $('.annotation-timeline-item.active');
                            $selected.addClass('no-pointer-events');
                            $selected.each(function() {
                                $(this).data('originalStart', $(this).data('start'));
                                $(this).data('originalEnd', $(this).data('end'));
                            });
                            timestampScrollbar($(this).data('start'));
                            $('#timeline-items').addClass('no-pointer-events');
                        },
                        'resize': async function(e, ui) {
                            let timestamp = 0;
                            if (ui.originalPosition.left != ui.position.left || ui.originalSize.width == ui.size.width) {
                                if (ui.position.left < 0) {
                                    ui.position.left = 0;
                                }
                                timestamp = ((ui.position.left)
                                    / $('#annotation-timeline').width()) * self.totaltime + self.start;
                            } else {
                                timestamp = ((ui.position.left + ui.size.width)
                                    / $('#annotation-timeline').width()) * self.totaltime + self.start;
                            }

                            let left = (timestamp - self.start) / self.totaltime * 100;
                            $('#cursorbar').css('left', `calc(${left}% + 5px)`);
                            $('#position-marker').css('left', `${left}%`);
                            $('#vseek #bar #position').text(convertSecondsToMMSS(timestamp));

                            const newStart = ((ui.position.left) / $('#annotation-timeline').width()) * self.totaltime
                                + self.start;
                            let newEnd = ((ui.position.left + ui.size.width) / $('#annotation-timeline').width())
                                * self.totaltime + self.start;
                            $('#s-position').text(convertSecondsToMMSS(newStart));
                            $('#e-position').text(convertSecondsToMMSS(newEnd));

                            // Hide or show this element
                            let now = await self.player.getCurrentTime();
                            let $annowrapper = $videoWrapper.find(`.annotation-wrapper[data-item="${$(this).data('item')}"]`);
                            if (newStart <= now && newEnd >= now) {
                                $annowrapper.css('visibility', 'visible');
                            } else {
                                $annowrapper.css('visibility', 'hidden');
                            }

                            // Handle other selected elements: same position and width
                            let leftPercentage = ui.position.left / $('#annotation-timeline').width() * 100;
                            let newWidth = ui.size.width / $('#annotation-timeline').width() * 100;
                            let $selected = $('.annotation-timeline-item.active').not(this);
                            $selected.each(function() {
                                let $this = $(this);
                                $this.css({
                                    'left': leftPercentage + '%',
                                    'width': newWidth + '%'
                                });

                                $this.attr('data-start', newStart);
                                $this.attr('data-end', newEnd);
                                let $annowrapper = $videoWrapper.find(`.annotation-wrapper[data-item="${$this.data('item')}"]`);
                                if (newStart <= now && newEnd >= now) {
                                    $annowrapper.css('visibility', 'visible');
                                } else {
                                    $annowrapper.css('visibility', 'hidden');
                                }
                            });
                        },
                        'stop': async function(e, ui) {
                            setTimeout(function() {
                                $('#cursorbar, #position-marker').remove();
                                $('#timeline-items').removeClass('no-pointer-events');
                            }, 200);
                            const newStart = ((ui.position.left) / $('#annotation-timeline').width()) * self.totaltime
                                + self.start;
                            const newEnd = ((ui.position.left + ui.size.width) / $('#annotation-timeline').width())
                                * self.totaltime + self.start;
                            let $selected = $('.annotation-timeline-item.active');
                            $selected.each(function() {
                                let $this = $(this);
                                let elementid = $this.data('item');
                                let itemIndex = items.findIndex(x => x.id == elementid);
                                let item = items[itemIndex];
                                let elem = $videoWrapper.find(`.annotation-wrapper[data-item="${elementid}"]`);
                                let prop = item.properties;
                                prop.start = self.roundToTwo(newStart);
                                prop.end = self.roundToTwo(newEnd);
                                let duration = prop.end - prop.start;
                                if (prop.duration && prop.duration < duration) {
                                    prop.end = prop.start + prop.duration;
                                    // Correct the width.
                                    $this.css('width', (prop.duration / self.totaltime) * 100 + '%');
                                }
                                elem.attr('data-start', prop.start);
                                elem.attr('data-end', prop.end);
                                $this.attr('data-start', prop.start);
                                $this.attr('data-end', prop.end);
                                item.properties = prop;
                                items[itemIndex] = item;
                            });
                            $selected = $selected.map(function() {
                                return $(this).data('item');
                            }).get();
                            saveTracking($selected);
                            renderItems(items, $selected, false);
                        }
                    });

                    self.dispatchEvent('timeupdate', {time: currentTime});
                    return true;
                }
            });
        };

        /**
         * Append timestamp to the scrollbar.
         * @param {Number} seconds
         * @returns void
         */
        const timestampScrollbar = (seconds) => {
            const formattedTime = convertSecondsToMMSS(seconds);
            let $scrollbar = $('#scrollbar').clone();
            $scrollbar.attr('id', 'cursorbar');
            $scrollbar.find('#scrollhead').remove();
            $('#timeline-items').append($scrollbar);
            $('#vseek #bar').append(`<div id="position-marker" class="border-0">
                <div id="position" class="py-0 px-1" style="top:-10px;">
                ${formattedTime}</div></div>`);
        };

        const renderImage = (wrapper, item, prop, id, position) => {
            const parts = prop.timestamp.split(':');
            const timestamp = parts.length > 1 ? Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]) : -1;
            if (prop.gotourl != '') {
                wrapper.append(`<a href="${prop.gotourl}" target="_blank"><img src="${prop.url}" id="${id}"
                         class="annotation-content w-100 ${prop.shadow == '1' ? 'shadow' : ''}"
                         ${prop.rounded == 1 ? 'style="border-radius:1em;"' : ''} alt="${prop.formattedalttext}"/></a>`);
            } else {
                wrapper.append(`<img src="${prop.url}" id="${id}"
                              class="annotation-content w-100 ${prop.shadow == '1' ? 'shadow' : ''}
                              ${timestamp > 0 ? 'cursor-pointer' : ''}"
                               ${prop.rounded == 1 ? 'style="border-radius:1em;"' : ''} alt="${prop.formattedalttext}"/>`);
            }
            if (!self.isEditMode()) {
                if (prop.gotourl == '' && timestamp < 0) {
                    wrapper.removeClass('resizable');
                    wrapper.addClass('no-pointer');
                } else {
                    wrapper.addClass('clickable');
                }
                if (timestamp >= 0) {
                    wrapper.attr('data-timestamp', timestamp);
                }
            }
            wrapper.css(position);
            wrapper.css('height', 'auto');
            $videoWrapper.append(wrapper);
        };

        const renderVideo = (wrapper, item, prop, id, position) => {
            const type = item.type;
            const isAudio = !prop.url.endsWith('.mp4');
            let srcType = isAudio ? 'audio' : 'video';
            wrapper.append(`<${srcType} id="${id}" class="${prop.muted == 1 ? 'muted' : ''} w-100
                ${prop.shadow == 1 ? 'shadow' : ''}" ${prop.muted == 1 ? 'muted' : ''}
                preload="true" src="${prop.url}" style="overflow: hidden; border-radius: ${prop.rounded == 1 ? '1em' : '0'}"
                disablePictureInPicture/></${srcType}><div class="annotation-content w-100 h-100 position-absolute top-0
                ${type == 'audio' ? 'bg-light' : ''}"></div>`);
            let video = wrapper.find(srcType)[0];
            video.load(); // Have to preload.
            video.playsInline = true;
            if (!self.isEditMode() || $('#annotation-btns').length > 0) {
                wrapper.find(srcType).addClass('no-pointer');
                if (type == 'audio') {
                    wrapper.find(srcType).addClass('invisible');
                }
            }
            if (!self.isEditMode()) {
                wrapper.find('.annotation-content').addClass('no-pointer invisible');
                wrapper.addClass('no-pointer');
                if (prop.dismissable == 1 && prop.size != '100' && type != 'audio') {
                    wrapper.removeClass('no-pointer');
                    wrapper.append(`<div class="dismiss-btn">
                        <i class="bi bi-x-lg"></i></div>`);
                }
            }
            wrapper.css(position);
            if (type == 'audio') {
                wrapper.css('opacity', '0.5');
                wrapper.addClass('notresizable');
            }
            if (prop.freesize != 1) {
                wrapper.addClass('notresizable');
            }
            $videoWrapper.append(wrapper);
            recalculatingSize(wrapper);

            // Adjust time to sync.
            $(video).on('playing', async function() {
                wrapper.removeClass('bg-light');
                let t = await self.player.getCurrentTime();
                let videoTime = video.currentTime + prop.start;
                if (Math.abs(t - videoTime) > 0.5) {
                    video.currentTime = t - prop.start;
                }
            });

            $(video).on('waiting', async function() {
                wrapper.addClass('bg-light');
            });
        };

        const renderFile = async(wrapper, item, prop, id, position) => {
            let wrapperhtml = ``;
            const type = item.type;
            if (type == 'file') {
                wrapperhtml = `<a id="${id}"
                    class="btn ${prop.style} ${prop.rounded == '1' ? 'btn-rounded' : 'iv-rounded-0'}
                    annotation-content text-nowrap ${prop.shadow == '1' ? 'shadow' : ''} rotatey-180" href="${prop.url}"
                     target="_blank"><i class="bi bi-paperclip fs-unset"></i>${prop.formattedlabel != "" ?
                        `<span style="margin-left:0.25em;">${prop.formattedlabel}` : ''}</a>`;
            } else if (type == 'mute') {
                wrapperhtml = `<span id="${id}" tabindex="0" class="btn annotation-content text-nowrap
                ${prop.hidden == '1' ? (self.isEditMode() ? 'opacity-50' : 'd-none') : ''}">
                <i class="bi bi-volume-mute fs-unset"></i></span>`;
            }
            wrapper.append(`<div class="d-flex h-100">${wrapperhtml}</div>`);
            position.width = 0;
            wrapper.css(position);
            $videoWrapper.append(wrapper);
            recalculatingTextSize(wrapper, true);
        };

        const renderNavigation = (wrapper, item, prop, id, position) => {
            const parts = prop.timestamp.split(':');
            const timestamp = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
            wrapper.append(`<div class="d-flex h-100"><span id="${id}" tabindex="0"
                         class="btn ${prop.style} ${prop.rounded == '1' ? 'btn-rounded' : 'iv-rounded-0'}
                          annotation-content text-nowrap ${prop.shadow == '1' ? 'shadow' : ''}">
                          ${prop.formattedlabel}</span></div>`);
            position.width = 0;
            wrapper.css(position);
            $videoWrapper.append(wrapper);
            if (!self.isEditMode()) {
                wrapper.attr('data-timestamp', timestamp);
            }
            recalculatingTextSize(wrapper, true);
        };

        // Deprecated
        const renderText = (wrapper, item, prop, id, position) => {
            if (prop.url != undefined && prop.url != '') {
                wrapper.append(`<a id="${id}"
                     class="annotation-content text-nowrap ${prop.shadow == '1' ? 'text-shadow' : ''} d-block"
                      href="${prop.url}" target="_blank">${prop.formattedlabel}</a>`);
            } else {
                if (!self.isEditMode() || !$('#content-region').hasClass('no-pointer-events')) {
                    wrapper.addClass('no-pointer');
                }
                wrapper.append(`<div id="${id}"
                     class="annotation-content text-nowrap ${prop.shadow == '1' ? 'text-shadow' : ''}
                     ">${prop.formattedlabel}</div>`);
            }
            wrapper.position.width = 0;
            wrapper.css(position);
            const style = {
                'font-weight': prop.bold == '1' ? 'bold' : 'normal',
                'font-style': prop.italic == '1' ? 'italic' : 'normal',
                'text-decoration': prop.underline == '1' ? 'underline' : 'none',
                'color': prop.textcolor,
                'background': prop.bgcolor,
                'border-width': prop.borderwidth,
                'border-color': prop.bordercolor,
                'border-style': 'solid',
                'font-family': prop.textfont != '' ? prop.textfont : 'inherit',
            };
            wrapper.find('.annotation-content').css(style);
            $videoWrapper.append(wrapper);
            recalculatingTextSize(wrapper);
        };

        const renderTextBlock = (wrapper, item, prop, id, position) => {
            let textparts = prop.formattedlabel.split('\r\n');
            let textblock = '<div class="d-flex flex-column">';
            const timestamp = prop.timestamp.split(':');
            const time = timestamp.length > 1 ? Number(timestamp[0]) * 3600 + Number(timestamp[1]) * 60 + Number(timestamp[2])
                : -1;
            textparts.forEach((part) => {
                if (part.trim() == '') {
                    return;
                }
                textblock += `<span class="text-row text-nowrap iv-text-${prop.alignment}"
                         style='font-family: ${prop.textfont != '' ? prop.textfont : 'inherit'}'>
                         ${part}</span>`;
            });
            textblock += '</div>';
            if (prop.url != undefined && prop.url != '') {
                wrapper.append(`<a id="${id}"
                             class="annotation-content d-block ${prop.shadow == '1' ? 'text-shadow' : ''}"
                              href="${prop.url}" target="_blank">${textblock}</a>`);
                wrapper.addClass('clickable');
            } else {
                if (!self.isEditMode() || !$('#content-region').hasClass('no-pointer-events')) {
                    if (time >= 0) {
                        wrapper.addClass('cursor-pointer');
                    } else {
                        wrapper.addClass('no-pointer');
                    }
                }
                wrapper.append(`<div id="${id}"
                             class="annotation-content ${prop.shadow == '1' ? 'text-shadow' : ''}">${textblock}</div>`);

                if (time >= 0) {
                    wrapper.attr('data-timestamp', time);
                }
            }
            wrapper.position.width = 0;
            wrapper.css(position);
            const style = {
                'font-size': item.position.fontSize,
                'line-height': item.position.lineHeight,
                'font-weight': prop.bold == '1' ? 'bold' : 'normal',
                'font-style': prop.italic == '1' ? 'italic' : 'normal',
                'text-decoration': prop.underline == '1' ? 'underline' : 'none',
                'color': prop.textcolor,
                'background': prop.bgcolor,
                'border-radius': prop.rounded == '1' ? '0.3em' : '0',
                'border-width': prop.borderwidth,
                'border-color': prop.bordercolor,
                'border-style': 'solid',
            };
            wrapper.find('.annotation-content').css(style);
            $videoWrapper.append(wrapper);
            recalculatingTextSize(wrapper, false, true);
        };

        const renderShape = (wrapper, item, prop, id, position) => {
            const parts = prop.timestamp.split(':');
            const timestamp = parts.length > 1 ? Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]) : -1;
            if (prop.gotourl != '') {
                wrapper.append(`<a href="${prop.gotourl}" target="_blank"><div id="${id}"
                         class="annotation-content ${prop.shadow == '1' ? 'shadow' : ''}"
                          style="width: 100%; height: 100%;"></div></a>`);
                wrapper.addClass('clickable');
            } else {
                if (!self.isEditMode()) {
                    if (timestamp < 0) {
                        wrapper.addClass('no-pointer');
                    } else {
                        wrapper.addClass('clickable');
                    }
                }
                wrapper.append(`<div id="${id}" class="annotation-content ${prop.shadow == '1' ? 'shadow' : ''}"
                         style="width: 100%; height: 100%;"></div>`);
                if (timestamp >= 0) {
                    wrapper.attr('data-timestamp', timestamp);
                }
            }
            wrapper.css(position);
            const style = {
                'background': prop.bgcolor,
                'border-width': prop.borderwidth,
                'border-color': prop.bordercolor,
                'border-style': 'solid',
                'opacity': prop.opacity / 100,
            };
            if (prop.shape == 'circle') {
                style['border-radius'] = '50%';
            } else if (prop.shape == 'rectangle') {
                style['border-radius'] = prop.rounded == '1' ? '1em' : '0';
            }
            wrapper.find('.annotation-content').css(style);
            $videoWrapper.append(wrapper);
        };

        const renderHotspot = (wrapper, item, prop, id, position) => {
            wrapper.append(`<div id="${id}" class="annotation-content shadow-sm pulse" role="button"
                title="${prop.formattedtitle}"></div>`);
            position['aspect-ratio'] = '1';
            wrapper.css(position);
            const style = {
                'background-color': prop.color,
                'opacity': prop.opacity / 100,
                'border-radius': '50%',
                'aspect-ratio': '1',
            };
            wrapper.find('.annotation-content').css(style);
            $videoWrapper.append(wrapper);

            if (!self.isEditMode()) {
                if (prop.usemodal == '1') {
                    if (self.isBS5) {
                        wrapper.attr({
                            'data-bs-toggle': 'modal',
                        });
                    } else {
                        wrapper.attr({
                            'data-toggle': 'modal',
                        });
                    }
                } else {
                    let attr = {
                        'tabindex': -1,
                    };
                    if (self.isBS5) {
                        attr['data-bs-trigger'] = 'manual';
                        attr['data-bs-boundary'] = 'viewport';
                        attr['data-bs-placement'] = 'auto';
                        attr['data-bs-html'] = 'true';
                        attr['data-bs-content'] = '<div class="loader"></div>';
                        attr['data-bs-title'] = prop.formattedtitle
                            + `<i class="bi bi-x-circle-fill iv-ml-auto popover-dismiss cursor-pointer"
                                     style="font-size:1.5em;"></i>`;
                    } else {
                        attr['data-trigger'] = 'manual';
                        attr['data-boundary'] = 'viewport';
                        attr['data-placement'] = 'auto';
                        attr['data-html'] = 'true';
                        attr['data-content'] = '<div class="loader"></div>';
                        attr['data-title'] = prop.formattedtitle
                            + `<i class="bi bi-x-circle-fill iv-ml-auto popover-dismiss cursor-pointer"
                                     style="font-size:1.5em;"></i>`;
                    }

                    wrapper.attr(attr);

                    wrapper.popover({
                        container: '#wrapper',
                        html: true,
                        template: `<div class="popover inlineannotation-popover id-${id}"
                                 role="tooltip"><div class="arrow"></div>
                                 <h3 class="popover-header d-flex justify-content-between"></h3>
                                 <div class="popover-body rounded"></div>${prop.url != '' ?
                                `<div class="popup-footer bg-light p-2 rounded-bottom"><a href="${prop.url}"
                                      class="d-block w-100 iv-text-right rotatex-360" target="_blank">
                                      <i class="bi bi-arrow-right"><i></i></i></a></div>` : ''}</div>`,
                    });

                    wrapper.on('shown.bs.popover', async function() {
                        let $body = $(`.popover.id-${id} .popover-body`);
                        const html = await self.formatContent(prop.content.text, annotation.contextid);
                        $body.html(html);
                        notifyFilter($body);
                        wrapper.popover('update');
                    });
                    if (prop.openbydefault == '1') {
                        wrapper.popover('show');
                    }
                }
            }
        };

        /**
         * Render items on the annotation canvas.
         * @param {Array} elements array of elements to render
         * @param {Array} actives ids of active element
         * @param {Boolean} update first render or updating items
         */
        const renderItems = async(elements, actives, update) => {
            const currentTime = await self.player.getCurrentTime();
            if (!update) { // Clear the annotation-canvas if it is a new start.
                $videoWrapper.find(`.annotation-wrapper`).remove();
                $('#timeline #annotation-timeline').empty();
            }

            if (elements.length == 0) {
                if (actives) {
                    actives.forEach((active) => {
                        $videoWrapper.find(`.annotation-wrapper[data-item="${active}"]`).addClass('active');
                        setTimeout(function() {
                            $('#timeline #annotation-timeline').find(`.annotation-timeline-item[data-item="${active}"]`)
                                .addClass('active');
                        }, 200);
                    });
                }
            } else {
                // Sort element by z-index.
                elements.sort((a, b) => Number(b.position['z-index']) - Number(a.position['z-index']));
                elements = elements.filter(item => item.properties.start <= self.end && item.properties.end >= self.start);
                elements.map(async item => {
                    let start = item.properties.start;
                    let end = item.properties.end;
                    if (start < self.start) {
                        start = self.start;
                    }
                    if (end > self.end) {
                        end = self.end;
                    }

                    // Correct the time if the item is video. Make sure the total duration is not more than the video duration.
                    if (item.type == 'video' || item.type == 'audio') {
                        let duration = end - start;
                        await new Promise(resolve => {
                            let video = document.createElement(item.type);
                            video.src = item.properties.url;
                            video.onloadedmetadata = function() {
                                let videoDuration = video.duration;
                                if (duration > videoDuration) {
                                    end = start + videoDuration;
                                }
                                item.properties.duration = videoDuration;
                                // Remove the video element after getting the duration.
                                video.remove();
                                resolve();
                            };
                        });
                    }

                    item.properties.start = start;
                    item.properties.end = end;

                    return item;
                });

                let count = 0;
                elements.forEach(async(item) => {
                    let prop = item.properties;
                    let type = item.type;
                    let id = item.id;
                    let position = item.position;
                    let wrapper = $(`<div class="annotation-wrapper" data-group="${position.group}"
                         data-start="${self.roundToTwo(prop.start)}"
                         data-duration="${self.roundToTwo(prop.duration)}"
                     data-end="${self.roundToTwo(prop.end)}"  data-anno="${annotation.id}" data-item="${id}"
                      data-type="${type}"></div>`);
                    if (prop.resizable == '1' || self.isEditMode()) {
                        wrapper.addClass('resizable');
                        wrapper.attr('tabindex', 0);
                    }
                    // Correct the position in player mode.
                    if (!self.isEditMode()) {
                        const left = position.left.replace('%', '');
                        const top = position.top.replace('%', '');
                        const width = position.width.replace('%', '');
                        const height = position.height ? position.height.replace('%', '') : 0;
                        if (left < 0.01) {
                            position.left = '0%';
                        }
                        if (top < 0.01) {
                            position.top = '0%';
                        }
                        if (width > 99.5) {
                            position.width = '100%';
                        }
                        if (height > 99.5) {
                            position.height = '100%';
                        }
                    }
                    switch (type) {
                        case 'image':
                            renderImage(wrapper, item, prop, id, position);
                            break;
                        case 'file':
                        case 'mute':
                            renderFile(wrapper, item, prop, id, position);
                            break;
                        case 'navigation':
                            renderNavigation(wrapper, item, prop, id, position);
                            break;
                        case 'text':
                            renderText(wrapper, item, prop, id, position);
                            break;
                        case 'textblock':
                            renderTextBlock(wrapper, item, prop, id, position);
                            break;
                        case 'shape':
                            renderShape(wrapper, item, prop, id, position);
                            break;
                        case 'hotspot':
                            renderHotspot(wrapper, item, prop, id, position);
                            break;
                        case 'video':
                        case 'audio':
                            renderVideo(wrapper, item, prop, id, position);
                            break;
                    }

                    if (type != 'shape') {
                        wrapper.on('mouseover', function() {
                            if (!$(this).hasClass('resizable')) {
                                return;
                            }

                            let aspectRatio =
                                $(this).find('.annotation-content').width() / $(this).find('.annotation-content').height();
                            if (type == 'video') {
                                aspectRatio = $(this).find('video')[0].videoWidth / $(this).find('video')[0].videoHeight;
                            }
                            if (wrapper.width() / wrapper.height() != aspectRatio && (type == 'image' || type == 'video')) {
                                $(this).height((wrapper.width() / aspectRatio));
                            }
                            try {
                                $(this).resizable('option', 'aspectRatio', $(this).find('.annotation-content').outerWidth() /
                                    $(this).find('.annotation-content').outerHeight());
                            } catch (e) {
                                // Do nothing.
                            }
                        });
                    }

                    count++;

                    if (count == elements.length) {
                        $('.annotation-wrapper').css('visibility', 'hidden');
                        // Always trigger the timeupdate event after all items are rendered.
                        self.dispatchEvent('timeupdate', {time: self.roundToTwo(currentTime)});

                        if (self.isEditMode()) {
                            if ($('#annotation-btns').is(":visible") == false) {
                                $videoWrapper.find('.annotation-wrapper').addClass('no-pointer');
                            }
                            // Initialize the draggable and resizable for each item.
                            $videoWrapper.find('.annotation-wrapper:not(.notresizable)').draggable({
                                containment: "#annotation-canvas",
                                cursor: "move",
                                grid: [1, 1],
                                handle: '.annotation-content',
                                start: function() {
                                    getItems(false);
                                    // Get all the selected elements
                                    if (!$(this).hasClass('active')) {
                                        $(this).trigger('click');
                                    }
                                    let $selected = $videoWrapper.find('.annotation-wrapper.active');
                                    $selected.addClass('no-pointer');
                                    $selected.each(function() {
                                        $(this).data('startPosition', $(this).position());
                                    });
                                },
                                drag: function(event, ui) {
                                    let $selected = $videoWrapper.find('.annotation-wrapper.active');
                                    let left = ui.originalPosition.left - ui.position.left;
                                    let top = ui.originalPosition.top - ui.position.top;
                                    let positions = $selected.map(function() {
                                        return {
                                            id: $(this).data('item'),
                                            left: $(this).position().left,
                                            top: $(this).position().top,
                                            bottom: $(this).position().top + $(this).height(),
                                            right: $(this).position().left + $(this).width(),
                                        };
                                    }).get();

                                    if (positions.find(x => x.left < 0)) {
                                        // Sort the elements by left position to get the leftmost element
                                        positions.sort((a, b) => a.left - b.left);
                                        let onLeft = positions.find(x => x.left < 0);
                                        let id = onLeft.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('left', 0);
                                        let distance = target.data('startPosition').left;
                                        ui.position.left = ui.originalPosition.left - distance;
                                        left = ui.originalPosition.left - ui.position.left;
                                    }

                                    if (positions.find(x => x.top < 0)) {
                                        positions.sort((a, b) => a.top - b.top);
                                        let onTop = positions.find(x => x.top < 0);
                                        let id = onTop.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('top', 0);
                                        let distance = target.data('startPosition').top;
                                        ui.position.top = ui.originalPosition.top - distance;
                                        top = ui.originalPosition.top - ui.position.top;
                                    }

                                    if (positions.find(x => x.right > $('#annotation-canvas').width())) {
                                        positions.sort((a, b) => a.right - b.right);
                                        let onRight = positions.find(x => x.right > $('#annotation-canvas').width());
                                        let id = onRight.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('left', ($('#annotation-canvas').width() - target.width() - 1) + 'px');
                                        let distance = target.data('startPosition').left - target.position().left;
                                        ui.position.left = ui.originalPosition.left - distance;
                                        left = ui.originalPosition.left - ui.position.left;
                                    }

                                    if (positions.find(x => x.bottom > $('#annotation-canvas').height())) {
                                        positions.sort((a, b) => a.bottom - b.bottom);
                                        let onBottom = positions.find(x => x.bottom > $('#annotation-canvas').height());
                                        let id = onBottom.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('top', ($('#annotation-canvas').height() - target.height() - 1) + 'px');
                                        let distance = target.data('startPosition').top - target.position().top;
                                        ui.position.top = ui.originalPosition.top - distance;
                                        top = ui.originalPosition.top - ui.position.top;
                                    }

                                    $selected.not(this).each(function() {
                                        let $this = $(this);
                                        let position = $this.data('startPosition');
                                        $this.css({
                                            left: (position.left - left) + 'px',
                                            top: (position.top - top) + 'px',
                                        });
                                    });
                                    updatePositionInfo($(this));
                                },
                                stop: function() {
                                    let $selected = $videoWrapper.find('.annotation-wrapper.active');
                                    let positions = $selected.map(function() {
                                        return {
                                            id: $(this).data('item'),
                                            left: $(this).position().left,
                                            top: $(this).position().top,
                                            bottom: $(this).position().top + $(this).height(),
                                            right: $(this).position().left + $(this).width(),
                                        };
                                    }).get();

                                    if (positions.find(x => x.left < 0)) {
                                        positions.sort((a, b) => a.left - b.left);
                                        let onLeft = positions.find(x => x.left < 0);
                                        let id = onLeft.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('left', 0);
                                        let distance = target.data('startPosition').left;
                                        $selected.each(function() {
                                            let $this = $(this);
                                            let position = $this.data('startPosition');
                                            let newLeft = position.left - distance;
                                            $this.css('left', newLeft + 'px');
                                        });
                                    }

                                    if (positions.find(x => x.top < 0)) {
                                        positions.sort((a, b) => a.top - b.top);
                                        let onTop = positions.find(x => x.top < 0);
                                        let id = onTop.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('top', 0);
                                        let distance = target.data('startPosition').top;
                                        $selected.each(function() {
                                            let $this = $(this);
                                            let position = $this.data('startPosition');
                                            let newTop = position.top - distance;
                                            $this.css('top', newTop + 'px');
                                        });
                                    }

                                    if (positions.find(x => x.right > $('#annotation-canvas').width())) {
                                        positions.sort((a, b) => a.right - b.right);
                                        let onRight = positions.find(x => x.right > $('#annotation-canvas').width());
                                        let id = onRight.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('left', ($('#annotation-canvas').width() - target.width() - 1) + 'px');
                                        let distance = target.data('startPosition').left - target.position().left;
                                        $selected.each(function() {
                                            let $this = $(this);
                                            let position = $this.data('startPosition');
                                            let newLeft = position.left - distance;
                                            $this.css('left', newLeft + 'px');
                                        });
                                    }

                                    if (positions.find(x => x.bottom > $('#annotation-canvas').height())) {
                                        positions.sort((a, b) => a.bottom - b.bottom);
                                        let onBottom = positions.find(x => x.bottom > $('#annotation-canvas').height());
                                        let id = onBottom.id;
                                        let target = $videoWrapper.find(`.annotation-wrapper[data-item="${id}"]`);
                                        target.css('top', ($('#annotation-canvas').height() - target.height() - 1) + 'px');
                                        let distance = target.data('startPosition').top - target.position().top;
                                        $selected.each(function() {
                                            let $this = $(this);
                                            let position = $this.data('startPosition');
                                            let newTop = position.top - distance;
                                            $this.css('top', newTop + 'px');
                                        });
                                    }

                                    getItems(false);
                                    $selected = $selected.map(function() {
                                        return $(this).data('item');
                                    }).get();
                                    saveTracking($selected);
                                    if ($selected.length == 1) {
                                        $(this).trigger('click');
                                    }
                                    $videoWrapper.find('.annotation-wrapper').removeClass('no-pointer');
                                }
                            });

                            $videoWrapper.find('.annotation-wrapper:not(.notresizable)').resizable({
                                containment: "#annotation-canvas",
                                handles: "all",
                                grid: [1, 1],
                                minHeight: 1,
                                minWidth: 1,
                                resize: function(event) {
                                    let type = $(this).data('type');
                                    if (type == 'file' || type == 'navigation' || type == 'textblock'
                                        || type == 'mute') {
                                        recalculatingTextSize($(this), type != 'textblock', type == 'textblock');
                                    } else if (type == 'shape' && event.ctrlKey) {
                                        $(this).resizable('option', 'aspectRatio', 1);
                                    }
                                    updatePositionInfo($(this));
                                },
                                stop: function() {
                                    let type = $(this).data('type');
                                    if (type == 'file' || type == 'navigation' || type == 'textblock'
                                        || type == 'mute') {
                                        recalculatingTextSize($(this), type != 'textblock', type == 'textblock');
                                    } else if (type == 'shape') {
                                        $(this).resizable('option', 'aspectRatio', false);
                                    }
                                    recalculatingSize($(this));
                                    getItems(false);
                                    saveTracking([$(this).data('item')]);
                                    $(this).trigger('click');
                                }
                            });

                            await renderTimelineItems(elements, actives);
                            self.dispatchEvent('timeupdate', {time: self.roundToTwo(currentTime)});
                            self.dispatchEvent('annotationChanged');
                        }
                    }

                    if (actives && actives.includes(id)) {
                        wrapper.addClass('active');
                        if (actives.length == 1) {
                            setTimeout(function() {
                                wrapper.trigger('mouseover');
                                wrapper.trigger('click');
                            }, 500);
                        }
                    }
                });

                // Handle behavior for each item
                if (!self.isEditMode()) {
                    $videoWrapper.off('click', `.annotation-wrapper`).on('click', `.annotation-wrapper`, async function(e) {
                        e.stopImmediatePropagation();
                        let wrapper = $(this);
                        let type = wrapper.data('type');
                        switch (type) {
                            case 'navigation':
                            case 'image':
                            case 'hotspot':
                                await self.player.pause();
                                var hotspotid = wrapper.data('item');
                                var hotspot = items.find(x => x.id == hotspotid);
                                var viewertype = wrapper.data('toggle') || wrapper.data('bs-toggle');
                                if (viewertype == 'modal') {
                                    let title = hotspot.properties.formattedtitle;
                                    let content = hotspot.properties.content.text;
                                    let url = hotspot.properties.url;
                                    let modal = `<div class="modal fade" id="annotation-modal" role="dialog"
                                aria-labelledby="annotation-modal"
                             aria-hidden="true" data${self.isBS5 ? '-bs' : ''}-backdrop="static"
                              data${self.isBS5 ? '-bs' : ''}-keyboard="false">
                             <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" role="document">
                                <div class="modal-content iv-rounded-lg">
                                    <div class="modal-header d-flex align-items-center shadow-sm iv-iv-pr-0" id="title">
                                        <h5 class="modal-title text-truncate mb-0">${title}</h5>
                                        <button class="btn mx-2 p-0 close" aria-label="Close"
                                         data${self.isBS5 ? '-bs' : ''}-dismiss="modal">
                                            <i class="bi bi-x-lg fa-fw" style="font-size: x-large;"></i>
                                        </button>
                                    </div>
                                    <div class="modal-body" id="content">
                                    <div class="loader"></div>
                                    </div>
                                    ${url != '' ? `<div class="modal-footer bg-light p-2 rounded-bottom">
                                        <a href="${url}" class="d-block w-100 iv-text-right rotatex-360" target="_blank">
                                        <i class="bi bi-arrow-right"><i></i></i></a></div>` : ''}
                                    </div>
                                </div>
                                </div>`;
                                    $('#wrapper').append(modal);
                                    $('#annotation-modal').modal('show');
                                    $('#annotation-modal').on('hide.bs.modal', function() {
                                        $('#annotation-modal').remove();
                                    });
                                    $('#annotation-modal').on('shown.bs.modal', async function() {
                                        $('#annotation-modal .modal-body').fadeIn(300);
                                        let $body = $('#annotation-modal .modal-body');
                                        const html = await self.formatContent(content, annotation.contextid);
                                        $body.html(html);
                                        notifyFilter($body);
                                    });
                                } else {
                                    wrapper.popover('show');
                                }
                                break;
                        }

                        if ($(this).data('timestamp') != undefined) {
                            let timestamp = $(this).data('timestamp');
                            self.player.seek(timestamp);
                            self.player.play();
                        }
                    });

                    $playerWrapper.off('click', `.popover-dismiss`).on('click', `.popover-dismiss`, function(e) {
                        e.stopImmediatePropagation();
                        $(this).closest('.popover').remove();
                    });
                }
            }
        };

        // Check resize on video wrapper resize
        let vwrapper = document.querySelector('#video-wrapper');
        let resizeTimeout;
        let resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                let existingwrapper = $(`#annotation-canvas`).find(`.annotation-wrapper`);
                if (existingwrapper.length === 0) {
                    return;
                }
                existingwrapper.each(function() {
                    let wrapper = $(this);
                    let type = wrapper.data('type');
                    if (type === 'file' || type === 'navigation' || type === 'textblock' || type === 'mute') {
                        recalculatingTextSize(wrapper, type !== 'textblock', type === 'textblock');
                    } else if (type === 'video') {
                        recalculatingSize(wrapper);
                        let $annotationContent = wrapper.find('.annotation-content');
                        let aspectRatio = $annotationContent.width() / $annotationContent.height();
                        if (wrapper.width() / wrapper.height() !== aspectRatio) {
                            wrapper.height(wrapper.width() / aspectRatio);
                        }
                    }
                });
                $('#annotation-canvas').css('font-size', $('#annotation-canvas').width() / 75 + 'px');
            }, 100);
        });
        resizeObserver.observe(vwrapper);

        // Ready to render items.

        let items = [];
        let tracking = [];
        let trackingIndex = 0;
        if (data.items != '' && data.items !== null) {
            items = JSON.parse(data.items);
            tracking.push({
                items: JSON.stringify(items),
                actives: null,
                timestamp: self.start,
            });
        }
        let draftitemid = data.draftitemid;

        await renderItems(items, null, false);

        // End of view mode.
        if (!self.isEditMode()) {
            return;
        }

        /**
         * Update tracking data for redo and undo
         * @param {Array} actives array of active items
         */
        const saveTracking = (actives) => {
            if (trackingIndex < tracking.length - 1) {
                // Remove all the tracking data after the current index.
                tracking = tracking.slice(0, trackingIndex + 1);
            }
            tracking.push({
                items: JSON.stringify(items),
                actives: actives,
                timestamp: self.player.getCurrentTime(),
                at: new Date().getTime(),
            });
            tracking.sort((a, b) => a.at - b.at);
            trackingIndex = tracking.length - 1;
            $('#annotation-btns #undo').removeAttr('disabled');
            $('#annotation-btns #redo').attr('disabled', 'disabled');
            if (tracking.length == 1) {
                $('#annotation-btns #undo').attr('disabled', 'disabled');
            }
        };

        /**
         * Order items by layer.
         * @param {Array} ids array of item ids
         * @param {String} order asc or desc
         * @returns {Array} sorted array of item ids
         */
        const sortItemsByLayer = (ids, order) => {
            ids = ids.map(x => x.toString()); // Convert ids to string for consistency.
            let targetItems = items.filter(item => {
                const id = item.id.toString();
                return ids.includes(id);
            });
            if (order == 'desc') {
                targetItems.sort((a, b) => b.position['z-index'] - a.position['z-index']);
            } else {
                targetItems.sort((a, b) => a.position['z-index'] - b.position['z-index']);
            }

            return targetItems.map(item => item.id);
        };

        /**
         * Get highest z-index.
         * @param {Array} itms array of items
         * @returns {Number} top z-index
         */
        const getTopLayer = (itms) => {
            if (itms.length == 0) {
                return 5;
            }
            let ids = itms.map(item => item.id);
            let sorted = sortItemsByLayer(ids, 'desc');
            let zindex = itms.find(item => item.id == sorted[0]).position['z-index'];
            return Number(zindex);
        };

        /**
         * Get lowest z-index.
         * @param {Array} itms array of items
         * @returns {Number} bottom z-index
         */
        const getBottomLayer = (itms) => {
            if (itms.length == 0) {
                return 5;
            }
            let ids = itms.map(item => item.id);
            let sorted = sortItemsByLayer(ids, 'asc');
            let zindex = itms.find(item => item.id == sorted[0]).position['z-index'];
            return Number(zindex);
        };

        /**
         * Get all items from the annotation-canvas.
         * @param {Boolean} updateid whether or not to update the id of the item.
         */
        const getItems = (updateid) => {
            let newItems = [];
            const annos = $videoWrapper.find(`.annotation-wrapper`);
            annos.each(function(index, element) {
                const id = $(element).data('item');
                let item = {
                    "type": $(element).data('type'),
                    "position": recalculatingSize($(element)),
                };
                item.id = id;
                item.properties = items.find(x => x.id == id).properties;
                if (updateid) {
                    item.id = new Date().getTime() + index;
                    $(element).attr('data-item', item.id);
                }
                newItems.push(item);
            });
            items = newItems;
            draftStatus = 'draft';
        };

        /**
         * Handle form data when adding or editing an item.
         * @param {Object} newItem data from form submission
         * @param {String} type type of the item
         * @param {Boolean} add adding or editing
         */
        const handleFormData = async(newItem, type, add) => {
            switch (type) {
                case 'file':
                    if (add) {
                        newItem.position.height = '40px';
                        newItem.position.width = '130px';
                    }
                    break;
                case 'textblock':
                    if (add) {
                        newItem.position.fontSize = '16px';
                        newItem.position.lineHeight = '20px';
                    }
                    break;
                case 'shape':
                    if (add) {
                        newItem.position.height = '100px';
                        newItem.position.width = '100px';
                    }
                    break;
                case 'mute':
                    if (add) {
                        newItem.position.height = '40px';
                        newItem.position.width = '40px';
                    }
                    break;
                case 'video':
                case 'audio':
                    await new Promise(resolve => {
                        // Check duration of the video.
                        var thisvideo = document.createElement('video');
                        thisvideo.src = newItem.properties.url;
                        thisvideo.onloadedmetadata = function() {
                            let videoDuration = thisvideo.duration;
                            newItem.properties.duration = videoDuration;
                            newItem.properties.width = thisvideo.videoWidth;
                            newItem.properties.height = thisvideo.videoHeight;
                            if (add) {
                                newItem.properties.end = newItem.properties.start + videoDuration;
                            } else {
                                if (newItem.properties.end > newItem.properties.start + videoDuration) {
                                    newItem.properties.end = newItem.properties.start + videoDuration;
                                }
                            }
                            // Remove the video element after getting the duration.
                            thisvideo.remove();
                            resolve();
                        };
                    });
                    if (type == 'video') {
                        newItem.position.height = 'auto';
                        // Video wrapper width and height.
                        let videoWidth = $(`#annotation-canvas`).width();
                        let videoHeight = $(`#annotation-canvas`).height();
                        if (newItem.properties.freesize != 1) {
                            let vwidth = videoWidth * newItem.properties.size / 100;
                            let vheight = vwidth * newItem.properties.height / newItem.properties.width;
                            newItem.position.width = vwidth + 'px';
                            newItem.position.height = vheight + 'px';
                            let padding = vwidth * 0.05;
                            if (newItem.properties.size == '100') {
                                newItem.position.width = '100%';
                                newItem.position.height = '100%';
                                newItem.position.left = '0';
                                newItem.position.top = '0';
                            } else {
                                // eslint-disable-next-line max-depth
                                if (newItem.properties.vposition == 'center-center') {
                                    newItem.position.left = videoWidth / 2 - vwidth / 2 + 'px';
                                    newItem.position.top = videoHeight / 2 - vheight / 2 + 'px';
                                } else if (newItem.properties.vposition == 'center-left') {
                                    newItem.position.left = padding + 'px';
                                    newItem.position.top = videoHeight / 2 - vheight / 2 + 'px';
                                } else if (newItem.properties.vposition == 'center-right') {
                                    newItem.position.left = videoWidth - vwidth - padding + 'px';
                                    newItem.position.top = videoHeight / 2 - vheight / 2 + 'px';
                                } else if (newItem.properties.vposition == 'top-left') {
                                    newItem.position.left = padding + 'px';
                                    newItem.position.top = padding + 'px';
                                } else if (newItem.properties.vposition == 'top-center') {
                                    newItem.position.left = videoWidth / 2 - vwidth / 2 + 'px';
                                    newItem.position.top = padding + 'px';
                                } else if (newItem.properties.vposition == 'top-right') {
                                    newItem.position.left = videoWidth - vwidth - padding + 'px';
                                    newItem.position.top = padding + 'px';
                                } else if (newItem.properties.vposition == 'bottom-left') {
                                    newItem.position.left = padding + 'px';
                                    newItem.position.top = videoHeight - vheight - padding + 'px';
                                } else if (newItem.properties.vposition == 'bottom-center') {
                                    newItem.position.left = videoWidth / 2 - vwidth / 2 + 'px';
                                    newItem.position.top = videoHeight - vheight - padding + 'px';
                                } else if (newItem.properties.vposition == 'bottom-right') {
                                    newItem.position.left = videoWidth - vwidth - padding + 'px';
                                    newItem.position.top = videoHeight - vheight - padding + 'px';
                                } else {
                                    newItem.position.left = padding + 'px';
                                    newItem.position.top = padding + 'px';
                                }
                            }
                        }
                    }
                    if (add && type == 'audio') {
                        newItem.position.height = '40px';
                        newItem.position.width = '40px';
                        newItem.position.top = '0';
                        newItem.position.left = '0';
                    }

                    break;
                case 'image':
                    newItem.position.height = 'auto';
                    break;
                case 'hotspot':
                    if (add) {
                        newItem.position.width = '5%';
                    }
                    break;
            }

            items.push(newItem);
            saveTracking([newItem.id]);
            renderItems(items, [newItem.id], false);
        };

        $(document).off('click', '.annotation-timeline-item').on('click', '.annotation-timeline-item', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $videoWrapper.find('.annotation-wrapper').removeClass('active');
            if (!e.ctrlKey && !e.metaKey) {
                let elementid = $(this).data('item');
                let elem = $videoWrapper.find(`.annotation-wrapper[data-item="${elementid}"]`);
                elem.trigger('click');
            } else {
                if ($(this).hasClass('active')) {
                    $(this).removeClass('active');
                } else {
                    $(this).addClass('active');
                }
            }

            let activeitems = $(`.annotation-timeline-item.active`);
            if (activeitems.length == 0) {
                $('#annotation-canvas #background').addClass('d-none').css('z-index', 0);
                $('#edit-btns').attr('data-active', '').addClass('d-none').removeClass('d-flex');
                $('#annotation-btns #edit').attr('disabled', 'disabled');
                $('#annotation-btns #edit').removeAttr('disabled');
            } else {
                let dataActive = activeitems.map(function() {
                    return $(this).data('item');
                }).get();

                dataActive.forEach((id) => {
                    $videoWrapper.find(`.annotation-wrapper[data-item=${id}]`).addClass('active');
                });

                let activewrapper = $videoWrapper.find('.annotation-wrapper.active');
                document.querySelector('.annotation-wrapper.active').focus();
                $('#edit-btns').attr('data-active', dataActive).addClass('d-flex').removeClass('d-none');
                if (activewrapper.length > 1) {
                    $('#annotation-btns #edit').attr('disabled', 'disabled');
                    $('#annotation-btns #position').addClass('d-none');
                } else {
                    $('#annotation-btns #edit').removeAttr('disabled');
                    $('#annotation-btns #position').removeClass('d-none');
                }

                $('#annotation-canvas #background').removeClass('d-none').css('z-index', 3);
            }
        });

        $(document).off('dblclick', '.annotation-timeline-item').on('dblclick', '.annotation-timeline-item', async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let currentTime = await self.player.getCurrentTime(); // We have to check if the time is different.
            let start = $(this).data('start');
            if (currentTime == start) {
                return;
            }
            self.player.seek($(this).data('start'));
            self.dispatchEvent('timeupdate', {time: $(this).data('start')});
        });

        $playerWrapper.off('click', `#annotation-btns #save`).on('click', `#annotation-btns #save`, async function(e) {
            e.stopImmediatePropagation();
            getItems(false);
            // Encode html tags
            let cleanItems = JSON.stringify(items).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let updateId = $videoWrapper.data('id');
            await $.ajax({
                url: M.cfg.wwwroot + '/mod/interactivevideo/ajax.php',
                method: "POST",
                dataType: "text",
                data: {
                    action: 'quick_edit_field',
                    sesskey: M.cfg.sesskey,
                    id: updateId,
                    field: 'content',
                    contextid: M.cfg.contextid,
                    draftitemid: draftitemid,
                    value: cleanItems,
                    cmid: self.cmid,
                    token: self.token,
                },
                success: function(data) {
                    let updated = JSON.parse(data);
                    draftStatus = null;
                    tracking = [];
                    $('#annotation-btns #redo, #annotation-btns #undo').attr('disabled', 'disabled');
                    self.dispatchEvent('annotationupdated', {
                        annotation: updated,
                        action: 'edit',
                    });
                }
            });
            $('#annotation-canvas #background').trigger('click');
            return true;
        });

        $(document).off('click', `#annotation-btns #closetoolbar`).on('click', `#annotation-btns #closetoolbar`, function(e) {
            e.stopImmediatePropagation();
            if (draftStatus == 'draft') {
                Notification.saveCancel(
                    M.util.get_string('unsavedchange', 'local_ivannotation'),
                    M.util.get_string('unsavedchangeconfirm', 'local_ivannotation'),
                    M.util.get_string('save', 'local_ivannotation'),
                    async function() {
                        // If the user clicks save, save the changes.
                        await $('#annotation-btns #save').trigger('click');
                        draftStatus = null;
                        tracking = [];
                        return $(`#annotation-btns #closetoolbar`).trigger('click');
                    },
                    function() {
                        // If the user clicks cancel, discard the changes.
                        let instance = tracking[0];
                        items = JSON.parse(instance.items);
                        renderItems(items, instance.actives, false);
                        draftStatus = null;
                        tracking = [];
                        $('#annotation-btns #redo, #annotation-btns #undo').attr('disabled', 'disabled');
                        $(`#annotation-btns #closetoolbar`).trigger('click');
                    }
                );
            } else {
                $(`#annotation-btns`).remove();
                $('#interaction-timeline, #video-timeline-wrapper').show();
                $('#timeline-btns div:not(#playbutton)').css('visibility', 'visible');
                $('#content-region').removeClass('no-pointer-events');
                $('#annotation-timeline').hide();
                $('#scrollbar').addClass('snap');
                $('#annotation-canvas .annotation-wrapper').addClass('no-pointer').removeClass('active');
            }
        });

        $playerWrapper.off('click', `#annotation-btns .add-ia`).on('click', `#annotation-btns .add-ia`, async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let annoid = $videoWrapper.data('id');
            let type = $(this).attr('data-mediatype');
            let start = await self.player.getCurrentTime();
            let end = start + 5;
            start = parseFloat(start).toFixed(2);
            end = parseFloat(end).toFixed(2);
            let iaform = new ModalForm({
                formClass: "local_ivannotation\\items\\" + $(this).attr('data-type'),
                args: {
                    contextid: M.cfg.contextid,
                    id: 0,
                    type: type,
                    annotationid: annoid,
                    start: start,
                    end: end,
                },
                modalConfig: {
                    title: M.util.get_string('addinlineannotation', 'local_ivannotation',
                        M.util.get_string(type, 'local_ivannotation')),
                }
            });

            iaform.show();

            iaform.addEventListener(iaform.events.LOADED, () => {
                iaform.modal.modal.draggable({
                    handle: ".modal-header",
                });
                if (type == 'navigation' || type == 'image' || type == 'shape') {
                    $(document).on('change', '.modal [name="timestamp"]', function(e) {
                        e.preventDefault();
                        let parts = $(this).val().split(':');
                        let timestamp = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
                        if (!self.isBetweenStartAndEnd(timestamp)) {
                            let message = M.util.get_string('timemustbebetweenstartandendtime', 'local_ivannotation', {
                                "start": self.convertSecondsToHMS(self.start),
                                "end": self.convertSecondsToHMS(self.end),
                            });
                            self.addNotification(message);
                            $(this).val($(this).attr('data-initial-value'));
                            return;
                        }

                        // Make sure the timestamp is not in the skip segment.
                        if (self.isInSkipSegment(timestamp)) {
                            self.addNotification(M.util.get_string('interactionisbetweentheskipsegment',
                                'local_ivannotation'));
                            $(this).val($(this).attr('data-initial-value'));
                            return;
                        }
                    });
                }
            });

            iaform.addEventListener(iaform.events.FORM_SUBMITTED, (e) => {
                e.stopImmediatePropagation();
                getItems(false);
                const highestOrder = getTopLayer(items);
                let left = Math.random() * 100;
                let top = Math.random() * 100;
                let newItem = {
                    "id": new Date().getTime(),
                    "type": type,
                    "position": {
                        "width": "30%",
                        "left": left + "px",
                        "top": top + "px",
                        "z-index": highestOrder + 1,
                    },
                    'properties': e.detail,
                };
                handleFormData(newItem, type, true);
            });
        });

        $playerWrapper.off('click', `#annotation-btns #edit`).on('click', `#annotation-btns #edit`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let annnoid = $videoWrapper.data('id');
            let active = $('#edit-btns').attr('data-active');
            getItems(false);
            let item = items.find(x => x.id == active);
            let type = item.type;
            let formdata = JSON.parse(JSON.stringify(item.properties));
            formdata.contextid = M.cfg.contextid;
            formdata.id = item.id;
            formdata.annotationid = annnoid;
            formdata.type = type;
            let editform = new ModalForm({
                formClass: "local_ivannotation\\items\\" +
                    (type == 'image' || type == 'file' || type == 'video' || type == 'audio' ? 'media' : type),
                args: formdata,
                modalConfig: {
                    title: M.util.get_string('editinlineannotation', 'local_ivannotation',
                        M.util.get_string(type, 'local_ivannotation')),
                }
            });

            editform.show();

            editform.addEventListener(editform.events.LOADED, () => {
                editform.modal.modal.draggable({
                    handle: ".modal-header",
                });
            });

            editform.addEventListener(editform.events.FORM_SUBMITTED, (e) => {
                e.stopImmediatePropagation();
                getItems(false);
                item = items.find(x => x.id == active);
                item.properties = e.detail;
                // Remove the item from the annotation-canvas
                $videoWrapper.find(`.annotation-wrapper[data-item="${active}"]`).remove();
                items = items.filter(x => x.id != active);
                handleFormData(item, type, false);
            });
        });

        $videoWrapper.off('click', `.annotation-wrapper`).on('click', `.annotation-wrapper`, async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await self.player.pause();
            if (!e.ctrlKey && !e.metaKey) {
                $videoWrapper.find('.annotation-wrapper').removeClass('active');
                $(this).addClass('active');
                this.focus();
                recalculatingSize($(this));
            } else {
                if ($(this).hasClass('active')) {
                    $(this).removeClass('active');
                } else {
                    $(this).addClass('active');
                    this.focus();
                }
            }

            if (!isNaN($(this).data('group'))) {
                let group = $(this).data('group');
                $videoWrapper.find(`.annotation-wrapper[data-group="${group}"]`).addClass('active');
            }

            recalculatingSize($(this));

            $(`#timeline #annotation-timeline .annotation-timeline-item`).removeClass('active');
            let activewrapper = $videoWrapper.find('.annotation-wrapper.active');
            if (activewrapper.length == 0) {
                $('#annotation-canvas #background').addClass('d-none').css('z-index', 0);
                $('#edit-btns').attr('data-active', '').addClass('d-none').removeClass('d-flex');
                $('#annotation-btns #edit').attr('disabled', 'disabled');
                $('#annotation-btns #edit').removeAttr('disabled');
            } else {
                let dataActive = activewrapper.map(function() {
                    return $(this).data('item');
                }).get();

                dataActive.forEach((id) => {
                    $(`#timeline #annotation-timeline .annotation-timeline-item[data-item="${id}"]`).addClass('active');
                });

                $('#edit-btns').attr('data-active', dataActive).addClass('d-flex').removeClass('d-none');
                if (activewrapper.length > 1) {
                    $('#annotation-btns #edit').attr('disabled', 'disabled');
                    $('#edit-btns #position').addClass('d-none');
                } else {
                    $('#annotation-btns #edit').removeAttr('disabled');
                    $('#edit-btns #position').removeClass('d-none');
                }
                $('#annotation-canvas #background').removeClass('d-none').css('z-index', 1);
            }

            // Enable ungroup button if the active items are grouped.
            let grouping = activewrapper.map(function() {
                if (isNaN($(this).data('group')) || $(this).data('group') == '') {
                    return '';
                }
                return $(this).data('group');
            }).get();

            grouping = [...new Set(grouping)];
            if (activewrapper.length < 2) {
                $('#annotation-btns #ungroup, #annotation-btns #group').attr('disabled', 'disabled').addClass('d-none');
            } else {
                if (grouping.length == 1) {
                    if (isNaN(grouping[0]) || grouping[0] == '') {
                        $('#annotation-btns #ungroup').attr('disabled', 'disabled').addClass('d-none');
                        $('#annotation-btns #group').removeAttr('disabled').removeClass('d-none');
                    } else {
                        $('#annotation-btns #ungroup').removeAttr('disabled').removeClass('d-none');
                        $('#annotation-btns #group').attr('disabled', 'disabled').addClass('d-none');
                    }
                } else if (grouping.length > 1) {
                    $('#annotation-btns #ungroup, #annotation-btns #group').removeAttr('disabled').removeClass('d-none');
                }
            }
        });

        $videoWrapper.off('dblclick', '.annotation-wrapper').on('dblclick', '.annotation-wrapper', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $(this).trigger('click');
            $('#annotation-btns #edit').trigger('click');
        });

        $(document).off('click', '#annotation-canvas #background').on('click', '#annotation-canvas #background', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $('#annotation-canvas .annotation-wrapper').removeClass('active');
            $('#edit-btns').attr('data-active', '').addClass('d-none').removeClass('d-flex');
            $(`#timeline #annotation-timeline .annotation-timeline-item`).removeClass('active');
            $('#annotation-canvas #background').addClass('d-none').css('z-index', 0);
        });

        $(document).off('click', `#annotation-btns #undo`).on('click', `#annotation-btns #undo`, async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (trackingIndex == 0) {
                return;
            }
            trackingIndex--;
            const instance = tracking[trackingIndex];
            items = JSON.parse(instance.items);
            renderItems(items, instance.actives, false);
            self.player.seek(instance.timestamp);
            if (trackingIndex == 0) {
                $('#annotation-btns #undo').attr('disabled', 'disabled');
                $('#annotation-btns #redo').removeAttr('disabled');
            } else {
                $('#annotation-btns #undo').removeAttr('disabled');
                if (trackingIndex == tracking.length - 1) {
                    $('#annotation-btns #redo').attr('disabled', 'disabled');
                } else {
                    $('#annotation-btns #redo').removeAttr('disabled');
                }
            }
        });

        $(document).off('click', `#annotation-btns #redo`).on('click', `#annotation-btns #redo`, async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (trackingIndex == tracking.length - 1) {
                return;
            }
            trackingIndex++;
            const instance = tracking[trackingIndex];
            items = JSON.parse(instance.items);
            renderItems(items, instance.actives, false);
            self.player.seek(instance.timestamp);
            if (trackingIndex == tracking.length - 1) {
                $('#annotation-btns #redo').attr('disabled', 'disabled');
                $('#annotation-btns #undo').removeAttr('disabled');
            } else {
                $('#annotation-btns #redo').removeAttr('disabled');
                if (trackingIndex == 0) {
                    $('#annotation-btns #undo').attr('disabled', 'disabled');
                } else {
                    $('#annotation-btns #undo').removeAttr('disabled');
                }
            }
        });

        const updateOrder = (active, direction) => {
            // First sort items by z-index descending
            getItems(false);
            items.sort((a, b) => b.position['z-index'] - a.position['z-index']);
            let activeIndex = items.findIndex(x => x.id == active);
            let activeItem = items[activeIndex];
            let currentzIndex = activeItem.position['z-index'];
            let affectedItem = null;
            let affectedItemIndex = null;
            if (direction == 'up') {
                if (activeIndex == 0) {
                    return;
                }
                affectedItemIndex = activeIndex - 1;
                affectedItem = items[affectedItemIndex];
                activeItem.position['z-index'] = affectedItem.position['z-index'];
                affectedItem.position['z-index'] = currentzIndex;
            } else {
                if (activeIndex == items.length - 1) {
                    return;
                }
                affectedItemIndex = activeIndex + 1;
                affectedItem = items[affectedItemIndex];
                activeItem.position['z-index'] = affectedItem.position['z-index'];
                affectedItem.position['z-index'] = currentzIndex;
            }
            items[activeIndex] = activeItem;
            items[affectedItemIndex] = affectedItem;
            $(`.annotation-wrapper[data-item="${active}"]`).css(activeItem.position);
            $(`.annotation-wrapper[data-item="${affectedItem.id}"]`).css(affectedItem.position);
            saveTracking([active]);
        };

        // Group the active items
        $(document).off('click', `#annotation-btns #group`).on('click', `#annotation-btns #group`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $(this).attr('disabled', 'disabled').addClass('d-none');
            $('#annotation-btns #ungroup').removeAttr('disabled').removeClass('d-none');
            getItems(false);
            let active = $('.annotation-wrapper.active').map(function() {
                return $(this).data('item');
            }).get();
            const group = new Date().getTime();
            active.forEach((item) => {
                let activeItem = $(`.annotation-wrapper[data-item="${item}"]`);
                let targetIndex = items.findIndex(x => x.id == item);
                let target = JSON.parse(JSON.stringify(items[targetIndex]));
                target.position.group = group;
                activeItem.attr('data-group', target.position.group);
                items[targetIndex] = target;
            });
            renderItems(items, active, false);
            saveTracking(active);
        });

        $(document).off('click', `#annotation-btns #ungroup`).on('click', `#annotation-btns #ungroup`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $(this).attr('disabled', 'disabled').addClass('d-none');
            $(`#annotation-btns #group`).removeAttr('disabled').removeClass('d-none');
            getItems(false);
            let active = $('.annotation-wrapper.active').map(function() {
                return $(this).data('item');
            }).get();
            active.forEach((item) => {
                let activeItem = $(`.annotation-wrapper[data-item="${item}"]`);
                let targetIndex = items.findIndex(x => x.id == item);
                let target = JSON.parse(JSON.stringify(items[targetIndex]));
                delete target.position.group;
                activeItem.attr('data-group', '');
                items[targetIndex] = target;
            });
            renderItems(items, active, false);
            saveTracking(active);
        });

        // Increase the z-index of the active items
        $(document).off('click', `#annotation-btns #up`).on('click', `#annotation-btns #up`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let active = $('#edit-btns').attr('data-active');
            active = active.split(',');
            const topLayer = getTopLayer(items);
            // Check if the active elements are already in the correct order based on their index positions in the items array
            if (active.length > 1) {
                active = sortItemsByLayer(active, 'desc');
                let indexes = [];
                items.sort((a, b) => b.position['z-index'] - a.position['z-index']);
                active.forEach((item) => {
                    indexes.push(items.findIndex(x => x.id == item));
                });
                indexes.sort((a, b) => a - b);
                if (Math.abs(indexes[0] - indexes[indexes.length - 1]) == active.length - 1) {
                    if (Number(items[indexes[0]].position['z-index']) == topLayer) {
                        return;
                    }
                }
            }
            active.forEach((item) => {
                updateOrder(item, 'up');
            });
            getItems(false);
            updatePositionInfo($(`.annotation-wrapper[data-item="${active[0]}"]`));
            renderTimelineItems(items, active);
        });

        // Decrease the z-index of the active items
        $(document).off('click', `#annotation-btns #down`).on('click', `#annotation-btns #down`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let active = $('#edit-btns').attr('data-active');
            active = active.split(',');
            const bottomLayer = getBottomLayer(items);
            // Check if the active elements are already in the correct order based on their index positions in the items array
            if (active.length > 1) {
                active = sortItemsByLayer(active, 'asc');
                let indexes = [];
                items.sort((a, b) => a.position['z-index'] - b.position['z-index']);
                active.forEach((item) => {
                    indexes.push(items.findIndex(x => x.id == item));
                });
                indexes.sort((a, b) => a - b);
                if (Math.abs(indexes[0] - indexes[indexes.length - 1]) == active.length - 1) {
                    if (Number(items[indexes[0]].position['z-index']) == bottomLayer) {
                        return;
                    }
                }
            }
            active.forEach((item) => {
                updateOrder(item, 'down');
            });
            getItems(false);
            updatePositionInfo($(`.annotation-wrapper[data-item="${active[0]}"]`));
            renderTimelineItems(items, active);
        });

        // Delete the active items
        $playerWrapper.off('click', `#annotation-btns #delete`).on('click', `#annotation-btns #delete`, function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let active = $('#edit-btns').attr('data-active');
            active = active.split(',');
            active.forEach((item) => {
                let activeItem = $(`.annotation-wrapper[data-item="${item}"]`);
                activeItem.remove();
                $('#edit-btns').attr('data-active', '').addClass('d-none').removeClass('d-flex');
            });
            getItems(false);
            renderTimelineItems(items, null);
            saveTracking(null);
        });

        // Duplicate the active items.
        $playerWrapper.off('click', `#annotation-btns #copy`).on('click', `#annotation-btns #copy`, async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            getItems(false);
            // Copy the active item.
            const highestOrder = getTopLayer(items);
            let active = $('#edit-btns').attr('data-active');
            active = active.split(',');
            active = sortItemsByLayer(active, 'asc');
            const currentTime = await self.player.getCurrentTime();
            let newItems = [];
            let groupIncrement = Math.round(Math.random() * 100);
            for (let i = 0; i < active.length; i++) {
                let a = active[i];
                let activeItem = $(`.annotation-wrapper[data-item="${a}"]`);
                activeItem.removeClass('active');
                const item = items.find(x => x.id == a);
                let newItem = JSON.parse(JSON.stringify(item));
                newItem.properties.end = currentTime + (newItem.properties.end - newItem.properties.start);
                newItem.properties.start = currentTime;
                newItem.position = recalculatingSize(activeItem);
                if (item.position.group) {
                    newItem.position.group = Number(item.position.group) + groupIncrement;
                }
                newItem.id = new Date().getTime() + i;
                newItems.push(newItem.id);
                newItem.position['z-index'] = Number(highestOrder) + i + 1;
                items.push(newItem);
                renderItems(items, null, false);
                if (i == active.length - 1) {
                    $('#edit-btns').attr('data-active', newItems.join(',')).addClass('d-flex').removeClass('d-none');
                    // Put focus on the first element
                    renderItems([], newItems, true);
                    setTimeout(() => {
                        getItems(false);
                        document.querySelector('.annotation-wrapper.active').focus();
                        updatePositionInfo($videoWrapper.find(`.annotation-wrapper[data-item="${newItem.id}"]`));
                        self.dispatchEvent('timeupdate', {time: currentTime});
                        saveTracking(newItems);
                    }, 500);
                }
            }
        });

        // Move items with keyboard arrow keys, ctrl + up to layer up, and ctrl + down to layer down.
        $playerWrapper.on('keydown', '.annotation-wrapper:not(.notresizable)', function(e) {
            let active = $('#edit-btns').attr('data-active');
            active = active.split(',');
            getItems(false);
            for (let i = 0; i < active.length; i++) {
                let a = active[i];
                let activeItem = $(`.annotation-wrapper[data-item="${a}"]`);
                if (activeItem != undefined) {
                    let position = activeItem.position();
                    let ctrl = e.ctrlKey || e.metaKey;
                    let step = 1;
                    // Prevent page scroll
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    switch (e.key) {
                        case 'ArrowUp':
                            if (position.top > 0) {
                                position.top = position.top - step;
                                saveTracking(active);
                            }
                            break;
                        case 'ArrowDown':
                            if (position.top + activeItem.outerHeight() < $videoWrapper.height()) {
                                position.top = position.top + step;
                                saveTracking(active);
                            }
                            break;
                        case 'ArrowLeft':
                            if (position.left > 0) {
                                position.left = position.left - step;
                                saveTracking(active);
                            }
                            break;
                        case 'ArrowRight':
                            if (position.left + activeItem.outerWidth() < $videoWrapper.width()) {
                                position.left = position.left + step;
                                saveTracking(active);
                            }
                            break;
                        case 'Delete':
                            $(`#annotation-btns #delete`).trigger('click');
                            return;
                        case 'd': // Ctrl + d to duplicate
                            if (ctrl) {
                                $(`#annotation-btns #copy`).trigger('click');
                            }
                            return;
                        default:
                            return;
                    }
                    activeItem.css(position);
                    recalculatingSize(activeItem);
                }
            }
        });

        // Listen to the annotationupdated event
        $(document).on('annotationdeleted', function(e) {
            let deleted = e.originalEvent.detail.annotation;
            let annoid = $videoWrapper.data('id');
            if (annoid == deleted.id) {
                $videoWrapper.find('.annotation-wrapper').remove();
                $(`#annotation-btns`).remove();
                $(`#timeline #annotation-timeline .annotation-timeline-item`).remove();
            }
        });

        // Confirm draft saved.
        window.addEventListener('beforeunload', (e) => {
            if (draftStatus !== null) {
                const confirmationMessage = M.util.get_string('unsavedchanges', 'mod_interactivevideo');
                e.returnValue = confirmationMessage;
                return confirmationMessage;
            }
            return true;
        });

        self.timepicker();
    }

    /**
     * Override the render method to add the items on the list of editing annotations
     * @param {Array} annotations The annotations array
     * @param {Object} listItem The list item
     * @param {Object} item The annotation object
     * @returns {void}
     */
    async renderEditItem(annotations, listItem, item) {
        this.annotations = annotations;
        listItem.removeAttr('id').removeClass('d-none');
        listItem.attr('data-type', item.type);
        listItem.addClass(item.type);
        listItem.attr('data-id', item.id);
        listItem.removeAttr('data-timestamp');
        listItem.find('.timestamp').remove();
        listItem.find('.title').text(M.util.get_string('pluginname', 'local_ivannotation')).addClass('no-pointer text-dark');
        listItem.find('.btn.xp').remove();
        listItem.find('.type-icon i').addClass(this.prop.icon);
        listItem.find('.type-icon').attr('title', this.prop.title);
        listItem.find('.btn.copy').remove();
        listItem.appendTo('#annotation-list');
        return listItem;
    }

    /**
     * Edit an annotation
     * @param {Array} annotations The annotations array
     * @param {number} id The annotation id
     * @returns {void}
     */
    async editAnnotation(annotations, id) {
        this.annotations = annotations;
        let item = this.annotations.find((annotation) => annotation.id == id);
        $('#annotation-canvas').attr('data-id', item.id);
        $('#interaction-timeline, #video-timeline-wrapper').hide();
        $('#timeline-btns div:not(#playbutton)').css('visibility', 'hidden');
        $('#content-region').addClass('no-pointer-events');
        $('#annotation-timeline').show();
        $('#annotation-canvas .annotation-wrapper').removeClass('no-pointer');
        $('#scrollbar').removeClass('snap');
        this.renderAnnotationToolbar(item);
    }

    /**
     * Add an annotation to the annotation list without the form as other annotation
     * @param {Array} annotations Array of annotations
     * @param {Number} timestamp timestamp
     * @param {Number} coursemodule Course module id
     * @returns void
     */
    async addAnnotation(annotations, timestamp, coursemodule) {
        let self = this;
        let data = {
            title: self.prop.title,
            timestamp: -1,
            contextid: M.cfg.contextid,
            type: self.prop.name,
            courseid: self.course,
            cmid: coursemodule,
            annotationid: self.interaction,
            hascompletion: 0,
            advanced: JSON.stringify({
                "visiblebeforecompleted": "1",
                "visibleaftercompleted": null,
                "clickablebeforecompleted": "1",
                "clickableaftercompleted": null,
                "replaybehavior": "1",
            }),
        };
        let ajax = await Ajax.call([{
            methodname: 'local_ivannotation_add',
            args: {
                annotationdata: JSON.stringify(data),
            },
            contextid: M.cfg.contextid,
        }])[0];

        let newAnnotation = JSON.parse(ajax.data);
        self.dispatchEvent('annotationupdated', {
            annotation: newAnnotation,
            action: 'add'
        });

        self.annotations = annotations;
        $('#contentmodal').modal('hide');
        newAnnotation.editmode = true;
        const content = await self.render(newAnnotation, 'json');
        $('#annotation-canvas').attr('data-id', newAnnotation.id);
        self.postContentRender(newAnnotation, content);
        self.editAnnotation(annotations, newAnnotation.id);
    }

    /**
     * What happens when an item runs
     * @param {Object} annotation The annotation object
     * @returns {Object} The annotation object
     */
    runInteraction(annotation) {
        return annotation;
    }
}