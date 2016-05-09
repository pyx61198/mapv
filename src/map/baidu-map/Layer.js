/**
 * @author kyle / http://nikai.us/
 */

import CanvasLayer from "./CanvasLayer";
import clear from "../../canvas/clear";
import drawHeatmap from "../../canvas/draw/heatmap";
import drawSimple from "../../canvas/draw/simple";
import drawGrid from "../../canvas/draw/grid";
import drawHoneycomb from "../../canvas/draw/honeycomb";
import drawText from "../../canvas/draw/icon";
import DataSet from "../../data/DataSet";
import Intensity from "../../utils/data-range/Intensity";
import Category from "../../utils/data-range/Category";
import Choropleth from "../../utils/data-range/Choropleth";
import Animator from "../../utils/animation/Animator";

function Layer(map, dataSet, options) {
    var intensity = new Intensity({
        maxSize: options.maxSize,
        gradient: options.gradient,
        max: options.max
    });

    this.map = map;

    var category = new Category(options.splitList);

    var choropleth = new Choropleth(options.splitList);

    var canvasLayer = this.canvasLayer = new CanvasLayer({
        map: map,
        update: update
    });

    dataSet.on('change', function() {
        canvasLayer.draw();
    });

    if (options.draw == 'time') {
        var animator = new Animator(function (time) {
            update.call(canvasLayer, time);
        }, {
            steps: options.steps || 100,
            animationDuration: options.duration || 10
        });
        animator.start();

        map.addEventListener('movestart', function () {
            animator.pause();
        });

        map.addEventListener('moveend', function () {
            animator.start();
        });
    }

    function update(time) {

        var context = this.canvas.getContext("2d");

        if (options.draw == 'time') {
            if (time === undefined) {
                return;
            }
            context.save();
            context.globalCompositeOperation = 'destination-out';
            context.fillStyle = 'rgba(0, 0, 0, .1)';
            context.fillRect(0, 0, context.canvas.width, context.canvas.height);
            context.restore();
        } else {
            clear(context);
        }

        for (var key in options) {
            context[key] = options[key];
        }

        var zoomUnit = Math.pow(2, 18 - map.getZoom());
        var projection = map.getMapType().getProjection();

        var dataGetOptions = {
            transferCoordinate: function (coordinate) {
                var pixel = map.pointToPixel(new BMap.Point(coordinate[0], coordinate[1]));
                return [pixel.x, pixel.y];
            }
        }

        if (time !== undefined) {
            dataGetOptions.filter = function(item) {
                var trails = options.trails || 5;
                if (time && item.time > (time - trails) && item.time < time) {
                    return true;
                } else {
                    return false;
                }
            }
        }

        // get data from data set
        var data = dataSet.get(dataGetOptions);

        // deal with data based on draw
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (options.draw == 'bubble') {
                data[i].size = intensity.getSize(item.count);
            } else if (options.draw == 'intensity') {
                if (data[i].geometry.type === 'LineString') {
                    data[i].strokeStyle = intensity.getColor(item.count);
                } else {
                    data[i].fillStyle = intensity.getColor(item.count);
                }
            } else if (options.draw == 'category') {
                data[i].fillStyle = category.get(item.count);
            } else if (options.draw == 'choropleth') {
                data[i].fillStyle = choropleth.get(item.count);
            }
        }

        // draw
        if (options.draw == 'heatmap') {
            drawHeatmap.draw(context, new DataSet(data), options);
        } else if (options.draw == 'grid' || options.draw == 'honeycomb') {
            var data1 = dataSet.get();
            var minx = data1[0].geometry.coordinates[0];
            var maxy = data1[0].geometry.coordinates[1];
            for (var i = 1; i < data1.length; i++) {
                if (data1[i].geometry.coordinates[0] < minx) {
                    minx = data1[i].geometry.coordinates[0];
                }
                if (data1[i].geometry.coordinates[1] > maxy) {
                    maxy = data1[i].geometry.coordinates[1];
                }
            }
            var nwPixel = map.pointToPixel(new BMap.Point(minx, maxy));
            options.offset = {
                x: nwPixel.x,
                y: nwPixel.y
            };
            if (options.draw == 'grid') {
                drawGrid.draw(context, new DataSet(data), options);
            } else {
                drawHoneycomb.draw(context, new DataSet(data), options);
            }
        } else if (options.draw == 'text') {
            drawText.draw(context, new DataSet(data), options);
        } else if (options.draw == 'icon') {
            drawText.draw(context, new DataSet(data), options);
        } else {
            drawSimple.draw(context, new DataSet(data), options);
        }

    };

}

Layer.prototype.show = function () {
    this.map.addOverlay(this.canvasLayer);
}

Layer.prototype.hide = function () {
    this.map.removeOverlay(this.canvasLayer);
}

export default Layer;

