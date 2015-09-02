
function Classified(data, options) {
    this.parseOptions(options || {});
    this.prepData(data);
    this.packDots();
    this.svg = d3.select(this.selector)
        //.style("background-color", "lightgray")
        .attr("width", this.width).attr("height", this.height);

    this.showCircles();
}
Classified.prototype.parseOptions = function(options) {
    this.width = options.width || 600;
    this.height = options.height || 500;
    if (this.height < 400) { this.height = 400; }
    if (this.width < 400) { this.width = 400; }
    this.radius = 5;
    this.margin = 10;
    this.bars_height = 300;
    this.dots_height = this.height - this.bars_height - this.margin * 2;
    this.dots_width = this.width - this.margin * 2;
    this.selector = options.selector;
};
Classified.prototype.prepData = function(data) {

    var dots = [], dot, n_pos = 0,
        arr = Object.prototype.toString.call(data[0]) === '[object Array]';

    var truth = function(t) {
        // return truth of prediction
        return (this.proba > t) ? this.label : ! this.label;
    };
    var tc = function(t) {
        // return truth of prediction and class
        return (this.proba > t) ? (this.label ? "tp" : "fp") : (this.label ? "fn" : "tn");
    };

    for (var i = 0; i < data.length; i++) {
        if (arr) { dot = {'proba': data[i][0], 'label': data[i][1] > 0}; }
        else { dot = data[i]; }
        dot.truth = truth;
        dot.tc = tc;
        n_pos += dot.label;
        dots.push(dot);
    }
    dots.sort(function (a, b) {return a.proba - b.proba;});

    this.size = data.length;
    this.data = dots;
    this.n_pos = n_pos;
    this.n_neg = this.size - n_pos;
    this.t_idx = this.n_neg;
    this.p_max = dots[this.size - 1].proba;
    this.p_min = dots[0].proba;
};

Classified.prototype.packDots = function() {

    var rows = [], bottom, size = this.size, height = this.dots_height,
        data = this.data,
        dist = Math.min(this.radius * 2 * 1.1, Math.pow(1. * this.dots_width * this.dots_height / this.size, 0.5));

    var p2x = d3.scale.linear().range([0, this.dots_width])
        .domain(d3.extent(data, function(d) {return d.proba;})).nice();
    for (var i = 0; i < this.size; i++) {
        data[i].x = p2x(data[i].proba);
        data[i].index = i;
    }

    for (var k = 0; k < 100; k++) {
        bottom = height - dist / 1.1 / 2;
        rows = [];
        for (var i = 0; i < size; i++) {
            for (j = 0; j < rows.length & rows[j] > data[i].x; j++) {}
            rows[j] = data[i].x + dist;
            data[i].y = bottom - (j * dist);
        }
        if (rows.length * dist < bottom) { break; }
        else { dist = dist * .95 }
    }

    this.p2x = p2x;
    this.radius = (dist) / 1.1 / 2;
    this.y_max = dist * rows.length;
    console.log('Distance: ' + dist);
    console.log('Radius: ' + this.radius);

};

Classified.prototype.showCircles = function() {

    var delay = 2000 / this.size;

    var xAxis = d3.svg.axis().scale(this.p2x).orient("bottom")   ;

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + this.margin + "," + (this.dots_height + this.margin + 1) + ")")
        .call(xAxis);
        //.append("text").attr("class", "label")
        //.attr("x", -10).attr("y", -6)
        //.text("Probability");

    var t = this.data[this.n_neg].proba;
    this.threshold = t;
    var threshold = this.p2x(this.threshold),
        origin = this.dots_height - this.y_max,
        y_max = this.y_max,
        size = this.size;
    this.tp = 0;
    this.fp = 0;
    this.tn = 0;
    this.fn = 0;
    for (var i = 0; i < this.size; i++) {
        this[this.data[i].tc(t)] += 1;
    }

    this.svg.append("g")
        .attr("transform", "translate(" + this.margin + "," + this.margin + ")")
        .selectAll(".dot").data(this.data)
        .enter().append("circle")
        .attr("r", 0)
        .attr("cx", threshold)
        .attr("cy", function(d, i) {return y_max - y_max * i / size})
        .attr("class", function(d) {return "dot " + d.tc(t);})
        .attr("tc", function(d) {return d.tc(t);})
        .transition()
        .duration(100)
        .delay(function(d, i) {return i * delay})
        .attr("r", this.radius)
        .attr("cx", function(d) {return d.x;})
        .attr("cy", function(d) {return d.y;})

    var yline = this.svg.append("g")
        .attr("transform", "translate(" + this.margin + "," + this.margin + ")")
        .append("line")
        .style("stroke", "black").style("stroke-linecap", "butt")
        .style("stroke-dasharray", "2,3")
        .attr("x1", threshold).attr("x2", threshold)
        .attr("y1", origin)
        .attr("y2", this.dots_height + 1.5);

    var pmark = this.svg.append("g")
        .attr("transform", "translate(" + this.margin + "," + this.margin + ")")
        .append("circle")
        .attr("r", 2)
        .attr("cx", threshold)
        .attr("cy", this.dots_height + 1.5);


    var circles = this.svg.selectAll('circle.dot')[0]
        radius = this.radius;
    this.circles = circles;
    var c = this;
    var paint = function(t) {
        var new_class = this.tc(t), dot = d3.select(circles[this.index]);

        c[dot.attr("tc")]--;
        c[new_class]++;
        dot.attr('tc', new_class)
            .attr("class", "dot " + new_class);
        dot.attr("r", radius - (!this.truth(t) / 2));
        console.log({'fp': c.fp, 'tp': c.tp, 'fn': c.fn, 'tn': c.tn, 'sum': c.fp + c.tp + c.fn + c.tn});
    };
    var prev = this.data[0].proba, diff = 0, min_diff = 1;
    for (var i = 0; i < this.size; i++) {
        this.data[i].paint = paint;
        diff = this.data[i].proba - prev
        if (diff > 0 & diff < min_diff) {
            min_diff = diff;
        }
    }
    this.min_diff = min_diff;

    var focus = this.svg.append("g").attr("class", "focus").style("display", "none");

    this.overlay = this.svg.append("rect")
        .attr("transform", "translate(" + this.margin + "," + this.margin + ")")
        .attr("class", "overlay")
        .attr("width", this.dots_width)
        .attr("height", this.dots_height)
        .on("mouseover", function() { focus.style("display", null); })
        .on("mouseout", function() { focus.style("display", "none"); })
        .on("mousemove", function() {
            var xy = d3.mouse(this);
            yline.attr("x1", xy[0]).attr("x2", xy[0]).attr("y1", xy[1]);
            pmark.attr("cx", xy[0]);
            c.updateCircles(c.p2x.invert(xy[0]));

        });

};
Classified.prototype.updateCircles = function(threshold) {
    if (Math.abs(threshold - this.threshold) < this.min_diff){
        return;
    }
    //if (threshold > this.data[this.size]){threshold = this.data[this.size].proba}
    //if (threshold < this.data[0]){threshold = this.data[0].proba}

    var data = this.data, size = this.size;
    //console.log([threshold, this.threshold, this.t_idx]);


    var previous = this.threshold;
    this.threshold = threshold;
    if (threshold > previous) {
        for (i = this.t_idx; i < size && data[i].proba < threshold ; i++) {
            data[i].paint(threshold);
        }
    } else {
        for (i = this.t_idx; i >= 0 && data[i].proba > threshold ; i--) {
            data[i].paint(threshold);
        }
    }
    if (i < 0) { this.t_idx = 0; }
    else if (i >= size) { this.t_idx = size - 1; }
    else { this.t_idx = i; }

};
Classified.prototype.showMetric = function() {
};
Classified.prototype.showROCCurve = function() {
};
Classified.prototype.show = function() {
};
Classified.prototype.update = function() {
};

function classified(data, options) {
    return new Classified(data, options);
}
