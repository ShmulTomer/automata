/*
 Finite State Machine Designer (http://madebyevan.com/fsm/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/
function copyToClipboard() {
  var text = document.getElementById("output").value;
  navigator.clipboard.writeText(text).then(
    function () {
      // Show the toast message
      var toast = document.getElementById("toast");
      toast.className = "toast show";
      setTimeout(function () {
        toast.className = toast.className.replace("show", "");
      }, 3000);
    },
    function (err) {
      console.error("Could not copy text: ", err);
    },
  );
}

function saveAsTex() {
  var text = document.getElementById("output").value;
  var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "automata.tex";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

var selectedColor = "default"; // Default value

function setColor(color) {
  selectedColor = color;

  // Array of button IDs
  var buttonIds = ["defaultButton", "style1Button", "style2Button"];

  // Remove active class from all style buttons
  buttonIds.forEach(function (buttonId) {
    document.getElementById(buttonId).classList.remove("active");
  });

  // Add active class to the clicked button
  var buttonId = color + "Button";
  document.getElementById(buttonId).classList.add("active");

  draw();
}

function clearAll(noAlert = false) {
  if (
    !noAlert &&
    !confirm(
      "Are you sure you want to clear everything? This cannot be undone.",
    )
  ) {
    return;
  }

  // Clear the arrays
  nodes = [];
  links = [];

  // Reset selected object
  selectedObject = null;
  globalCounter = 0;

  // Redraw the canvas
  draw();
}

function escapeLaTeX(str) {
  return str
      .replaceAll(/\\(?![a-zA-Z0-9_])/g, "\\backslash")
      .replaceAll("$", "\\$")
      .replaceAll("#", "\\#")
      .replaceAll("%", "\\%")
      .replaceAll("&", "\\&")
      .replaceAll(" ", "~") // Replace spaces with non-breaking spaces
      .replaceAll("\\epsilon", "\\varepsilon")
      .replaceAll("\\blank", "\\textvisiblespace");
}

// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
  this._texData = "";

  this._points = [];
  this._texData = "";
  this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

  this.toLaTeX = function () {
    var header =
      "\\documentclass[12pt]{article}\n" +
      "\\usepackage{tikz}\n" +
      "\\usetikzlibrary{automata, positioning}\n" +
      "\\begin{document}\n" +
      "\\begin{tikzpicture}[shorten >=1pt,node distance=2cm,on grid,auto,scale=0.17";

    // Add the style based on the selected color
    if (selectedColor == "style1") {
      var colorStyle =
        ", every state/.style={fill,draw=none,blue,text=white}, accepting/.style ={green!50!black,text=white}]";
      header += colorStyle;
    } else if (selectedColor == "style2") {
      var colorStyle =
        ", every state/.style={fill,draw=none,red,text=white}, accepting/.style ={orange!80,text=white}]";
      header += colorStyle;
    }

    header += "]\n";

    if (selectedColor == "default") {
      header += "\\tikzset{accepting/.style={double distance=1mm}}\n";
    }

    var body = this.generateLaTeXBody();
    var footer = "\\end{tikzpicture}\n" + "\\end{document}\n";

    return header + body + footer;
  };

  this.generateLaTeXBody = function () {
    var latexBody = "";
    var i;

    // Loop through nodes to generate LaTeX code
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var stateOptions = [];
      if (node.isInitial) stateOptions.push("initial");
      if (node.isAcceptState) stateOptions.push("accepting");
      var stateOptionsStr =
        stateOptions.length > 0 ? "," + stateOptions.join(",") + "" : "";
      latexBody +=
        "\\node[state" +
        stateOptionsStr +
        ", label=center:{$" +
        (node.text.length === 0 ? " " : escapeLaTeX(node.text)) +
        "$}" +
        "] (" +
        node.id +
        ") at (" +
        fixed(node.x * this._scale, 2) +
        "," +
        fixed(-node.y * this._scale, 2) +
        ") {};\n";
    }

    const pi = 3.141592653;

    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (link instanceof SelfLink) {
        console.log(links[i]);
        var loop = "left";
        if (link.anchorAngle > pi / 4 && link.anchorAngle < (pi * 3) / 4) {
          loop = "below";
        } else if (
          link.anchorAngle > (-3 * pi) / 4 &&
          link.anchorAngle < -pi / 4
        ) {
          loop = "above";
        } else if (link.anchorAngle > -pi / 4 && link.anchorAngle < pi / 4) {
          loop = "right";
        }
        latexBody +=
          "\\path[->] (" +
          link.node.id +
          ") edge[loop " +
          loop +
          "] node {$" +
          link.text +
          "$} ();\n";
      } else if (link.perpendicularPart === 0) {
        // Straight link
        latexBody +=
          "\\path[->] (" +
          link.nodeA.id +
          ") edge node [swap] {$" +
          (link.text.length === 0 ? " " : escapeLaTeX(link.text)) +
          "$} (" +
          link.nodeB.id +
          ");\n";
      } else {
        // Curved link
        console.log(link);
        var bendValue;
        var swap = "";
        if (Math.abs(link.perpendicularPart) >= 90) {
          bendValue = 80;
        } else if (Math.abs(link.perpendicularPart) >= 60) {
          bendValue = 50;
        } else {
          bendValue = 25;
        }
        var direction =
          link.perpendicularPart > 0 ? "bend right=" : "bend left=";
        if (link.perpendicularPart > 0) {
          swap = ", swap";
        }
        latexBody +=
          "\\path[->] (" +
          link.nodeA.id +
          ") edge[" +
          direction +
          bendValue +
          " " +
          swap +
          "] node {$" +
          (link.text.length === 0 ? " " : escapeLaTeX(link.text)) +
          "$} (" +
          link.nodeB.id +
          ");\n";
      }
    }

    return latexBody;
  };

  this.beginPath = function () {
    this._points = [];
  };
  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x *= this._scale;
    y *= this._scale;
    radius *= this._scale;
    if (endAngle - startAngle == Math.PI * 2) {
      this._texData +=
        "\\draw [" +
        this.strokeStyle +
        "] (" +
        fixed(x, 3) +
        "," +
        fixed(-y, 3) +
        ") circle (" +
        fixed(radius, 3) +
        ");\n";
    } else {
      if (isReversed) {
        var temp = startAngle;
        startAngle = endAngle;
        endAngle = temp;
      }
      if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
      }
      // TikZ needs the angles to be in between -2pi and 2pi or it breaks
      if (Math.min(startAngle, endAngle) < -2 * Math.PI) {
        startAngle += 2 * Math.PI;
        endAngle += 2 * Math.PI;
      } else if (Math.max(startAngle, endAngle) > 2 * Math.PI) {
        startAngle -= 2 * Math.PI;
        endAngle -= 2 * Math.PI;
      }
      startAngle = -startAngle;
      endAngle = -endAngle;
      this._texData +=
        "\\draw [" +
        this.strokeStyle +
        "] (" +
        fixed(x + radius * Math.cos(startAngle), 3) +
        "," +
        fixed(-y + radius * Math.sin(startAngle), 3) +
        ") arc (" +
        fixed((startAngle * 180) / Math.PI, 5) +
        ":" +
        fixed((endAngle * 180) / Math.PI, 5) +
        ":" +
        fixed(radius, 3) +
        ");\n";
    }
  };
  this.moveTo = this.lineTo = function (x, y) {
    x *= this._scale;
    y *= this._scale;
    this._points.push({ x: x, y: y });
  };
  this.stroke = function () {
    if (this._points.length == 0) return;
    this._texData += "\\draw [" + this.strokeStyle + "]";
    for (var i = 0; i < this._points.length; i++) {
      var p = this._points[i];
      this._texData +=
        (i > 0 ? " --" : "") +
        " (" +
        fixed(p.x, 2) +
        "," +
        fixed(-p.y, 2) +
        ")";
    }
    this._texData += ";\n";
  };
  this.fill = function () {
    if (this._points.length == 0) return;
    this._texData += "\\fill [" + this.strokeStyle + "]";
    for (var i = 0; i < this._points.length; i++) {
      var p = this._points[i];
      this._texData +=
        (i > 0 ? " --" : "") +
        " (" +
        fixed(p.x, 2) +
        "," +
        fixed(-p.y, 2) +
        ")";
    }
    this._texData += ";\n";
  };
  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = '20px "Times New Romain", serif';
    return c.measureText(text);
  };
  this.advancedFillText = function (text, originalText, x, y, angleOrNull) {
    if (text.replace(" ", "").length > 0) {
      var nodeParams = "";
      // x and y start off as the center of the text, but will be moved to one side of the box when angleOrNull != null
      if (angleOrNull != null) {
        var width = this.measureText(text).width;
        var dx = Math.cos(angleOrNull);
        var dy = Math.sin(angleOrNull);
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) (nodeParams = "[right] "), (x -= width / 2);
          else (nodeParams = "[left] "), (x += width / 2);
        } else {
          if (dy > 0) (nodeParams = "[below] "), (y -= 10);
          else (nodeParams = "[above] "), (y += 10);
        }
      }
      x *= this._scale;
      y *= this._scale;
      this._texData +=
        "\\draw (" +
        fixed(x, 2) +
        "," +
        fixed(-y, 2) +
        ") node " +
        nodeParams +
        "{$" +
        originalText.replace(/ /g, "\\mbox{ }") +
        "$};\n";
    }
  };

  this.translate = this.save = this.restore = this.clearRect = function () {};
}

// draw using this instead of a canvas and call toSVG() afterward
function ExportAsSVG() {
  this.fillStyle = "black";
  this.strokeStyle = "black";
  this.lineWidth = 1;
  this.font = "12px Arial, sans-serif";
  this._points = [];
  this._svgData = "";
  this._transX = 0;
  this._transY = 0;

  this.toSVG = function () {
    return (
      '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n<svg width="800" height="600" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' +
      this._svgData +
      "</svg>\n"
    );
  };

  this.beginPath = function () {
    this._points = [];
  };
  this.arc = function (x, y, radius, startAngle, endAngle, isReversed) {
    x += this._transX;
    y += this._transY;
    var style =
      'stroke="' +
      this.strokeStyle +
      '" stroke-width="' +
      this.lineWidth +
      '" fill="none"';

    if (endAngle - startAngle == Math.PI * 2) {
      this._svgData +=
        "\t<ellipse " +
        style +
        ' cx="' +
        fixed(x, 3) +
        '" cy="' +
        fixed(y, 3) +
        '" rx="' +
        fixed(radius, 3) +
        '" ry="' +
        fixed(radius, 3) +
        '"/>\n';
    } else {
      if (isReversed) {
        var temp = startAngle;
        startAngle = endAngle;
        endAngle = temp;
      }

      if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
      }

      var startX = x + radius * Math.cos(startAngle);
      var startY = y + radius * Math.sin(startAngle);
      var endX = x + radius * Math.cos(endAngle);
      var endY = y + radius * Math.sin(endAngle);
      var useGreaterThan180 = Math.abs(endAngle - startAngle) > Math.PI;
      var goInPositiveDirection = 1;

      this._svgData += "\t<path " + style + ' d="';
      this._svgData += "M " + fixed(startX, 3) + "," + fixed(startY, 3) + " "; // startPoint(startX, startY)
      this._svgData += "A " + fixed(radius, 3) + "," + fixed(radius, 3) + " "; // radii(radius, radius)
      this._svgData += "0 "; // value of 0 means perfect circle, others mean ellipse
      this._svgData += +useGreaterThan180 + " ";
      this._svgData += +goInPositiveDirection + " ";
      this._svgData += fixed(endX, 3) + "," + fixed(endY, 3); // endPoint(endX, endY)
      this._svgData += '"/>\n';
    }
  };
  this.moveTo = this.lineTo = function (x, y) {
    x += this._transX;
    y += this._transY;
    this._points.push({ x: x, y: y });
  };
  this.stroke = function () {
    if (this._points.length == 0) return;
    this._svgData +=
      '\t<polygon stroke="' +
      this.strokeStyle +
      '" stroke-width="' +
      this.lineWidth +
      '" points="';
    for (var i = 0; i < this._points.length; i++) {
      this._svgData +=
        (i > 0 ? " " : "") +
        fixed(this._points[i].x, 3) +
        "," +
        fixed(this._points[i].y, 3);
    }
    this._svgData += '"/>\n';
  };
  this.fill = function () {
    if (this._points.length == 0) return;
    this._svgData +=
      '\t<polygon fill="' +
      this.fillStyle +
      '" stroke-width="' +
      this.lineWidth +
      '" points="';
    for (var i = 0; i < this._points.length; i++) {
      this._svgData +=
        (i > 0 ? " " : "") +
        fixed(this._points[i].x, 3) +
        "," +
        fixed(this._points[i].y, 3);
    }
    this._svgData += '"/>\n';
  };
  this.measureText = function (text) {
    var c = canvas.getContext("2d");
    c.font = '20px "Times New Romain", serif';
    return c.measureText(text);
  };
  this.fillText = function (text, x, y) {
    x += this._transX;
    y += this._transY;
    if (text.replace(" ", "").length > 0) {
      this._svgData +=
        '\t<text x="' +
        fixed(x, 3) +
        '" y="' +
        fixed(y, 3) +
        '" font-family="Times New Roman" font-size="20">' +
        textToXML(text) +
        "</text>\n";
    }
  };
  this.translate = function (x, y) {
    this._transX = x;
    this._transY = y;
  };

  this.save = this.restore = this.clearRect = function () {};
}

// New

var nodes = [];
var links = [];

function StartLink(node, start) {
  this.node = node;
  this.deltaX = 0;
  this.deltaY = 0;
  this.text = "";

  if (start) {
    this.setAnchorPoint(start.x, start.y);
  }
}

StartLink.prototype.setAnchorPoint = function (x, y) {
  this.deltaX = x - this.node.x;
  this.deltaY = y - this.node.y;

  if (Math.abs(this.deltaX) < snapToPadding) {
    this.deltaX = 0;
  }

  if (Math.abs(this.deltaY) < snapToPadding) {
    this.deltaY = 0;
  }
};

StartLink.prototype.getEndPoints = function () {
  var startX = this.node.x + this.deltaX;
  var startY = this.node.y + this.deltaY;
  var end = this.node.closestPointOnCircle(startX, startY);
  return {
    startX: startX,
    startY: startY,
    endX: end.x,
    endY: end.y,
  };
};

StartLink.prototype.draw = function (c) {
  var stuff = this.getEndPoints();

  // draw the line
  c.beginPath();
  c.moveTo(stuff.startX, stuff.startY);
  c.lineTo(stuff.endX, stuff.endY);
  c.stroke();

  // draw the text at the end without the arrow
  var textAngle = Math.atan2(
    stuff.startY - stuff.endY,
    stuff.startX - stuff.endX,
  );
  drawText(
    c,
    this.text,
    stuff.startX,
    stuff.startY,
    textAngle,
    selectedObject == this,
  );

  // draw the head of the arrow
  drawArrow(c, stuff.endX, stuff.endY, Math.atan2(-this.deltaY, -this.deltaX));
};

StartLink.prototype.containsPoint = function (x, y) {
  var stuff = this.getEndPoints();
  var dx = stuff.endX - stuff.startX;
  var dy = stuff.endY - stuff.startY;
  var length = Math.sqrt(dx * dx + dy * dy);
  var percent =
    (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
  var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
  return percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding;
};

function Link(a, b) {
  this.nodeA = a;
  this.nodeB = b;
  this.text = "";
  this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line

  // make anchor point relative to the locations of nodeA and nodeB
  this.parallelPart = 0.5; // percentage from nodeA to nodeB
  this.perpendicularPart = 0; // pixels from line between nodeA and nodeB
}

Link.prototype.getAnchorPoint = function () {
  var dx = this.nodeB.x - this.nodeA.x;
  var dy = this.nodeB.y - this.nodeA.y;
  var scale = Math.sqrt(dx * dx + dy * dy);
  return {
    x:
      this.nodeA.x +
      dx * this.parallelPart -
      (dy * this.perpendicularPart) / scale,
    y:
      this.nodeA.y +
      dy * this.parallelPart +
      (dx * this.perpendicularPart) / scale,
  };
};

Link.prototype.setAnchorPoint = function (x, y) {
  var dx = this.nodeB.x - this.nodeA.x;
  var dy = this.nodeB.y - this.nodeA.y;
  var scale = Math.sqrt(dx * dx + dy * dy);

  this.parallelPart = 0.5;
  var unsnappedPerpendicular =
    (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;

  // Define your snap values for the perpendicular part
  var snapValues = [0, 30, 60, 100, -30, -60, -100];
  var maxSnap = Math.max(...snapValues);
  var minSnap = Math.min(...snapValues);

  // Clamp unsnappedPerpendicular within the range defined by maxSnap and minSnap
  unsnappedPerpendicular = Math.max(
    minSnap,
    Math.min(unsnappedPerpendicular, maxSnap),
  );

  var closestSnap = snapValues.reduce(function (prev, curr) {
    return Math.abs(curr - unsnappedPerpendicular) <
      Math.abs(prev - unsnappedPerpendicular)
      ? curr
      : prev;
  });

  this.perpendicularPart = closestSnap;

  if (
    this.parallelPart > 0 &&
    this.parallelPart < 1 &&
    Math.abs(this.perpendicularPart) < snapToPadding
  ) {
    this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
    this.perpendicularPart = 0;
  }
};

Link.prototype.getEndPointsAndCircle = function () {
  if (this.perpendicularPart == 0) {
    var midX = (this.nodeA.x + this.nodeB.x) / 2;
    var midY = (this.nodeA.y + this.nodeB.y) / 2;
    var start = this.nodeA.closestPointOnCircle(midX, midY);
    var end = this.nodeB.closestPointOnCircle(midX, midY);
    return {
      hasCircle: false,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
    };
  }
  var anchor = this.getAnchorPoint();
  var circle = circleFromThreePoints(
    this.nodeA.x,
    this.nodeA.y,
    this.nodeB.x,
    this.nodeB.y,
    anchor.x,
    anchor.y,
  );
  var isReversed = this.perpendicularPart > 0;
  var reverseScale = isReversed ? 1 : -1;
  var startAngle =
    Math.atan2(this.nodeA.y - circle.y, this.nodeA.x - circle.x) -
    (reverseScale * nodeRadius) / circle.radius;
  var endAngle =
    Math.atan2(this.nodeB.y - circle.y, this.nodeB.x - circle.x) +
    (reverseScale * nodeRadius) / circle.radius;
  var startX = circle.x + circle.radius * Math.cos(startAngle);
  var startY = circle.y + circle.radius * Math.sin(startAngle);
  var endX = circle.x + circle.radius * Math.cos(endAngle);
  var endY = circle.y + circle.radius * Math.sin(endAngle);
  return {
    hasCircle: true,
    startX: startX,
    startY: startY,
    endX: endX,
    endY: endY,
    startAngle: startAngle,
    endAngle: endAngle,
    circleX: circle.x,
    circleY: circle.y,
    circleRadius: circle.radius,
    reverseScale: reverseScale,
    isReversed: isReversed,
  };
};

Link.prototype.draw = function (c) {
  var stuff = this.getEndPointsAndCircle();
  // draw arc
  c.beginPath();
  if (stuff.hasCircle) {
    c.arc(
      stuff.circleX,
      stuff.circleY,
      stuff.circleRadius,
      stuff.startAngle,
      stuff.endAngle,
      stuff.isReversed,
    );
  } else {
    c.moveTo(stuff.startX, stuff.startY);
    c.lineTo(stuff.endX, stuff.endY);
  }
  c.stroke();
  // draw the head of the arrow
  if (stuff.hasCircle) {
    drawArrow(
      c,
      stuff.endX,
      stuff.endY,
      stuff.endAngle - stuff.reverseScale * (Math.PI / 2),
    );
  } else {
    drawArrow(
      c,
      stuff.endX,
      stuff.endY,
      Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX),
    );
  }
  // draw the text
  if (stuff.hasCircle) {
    var startAngle = stuff.startAngle;
    var endAngle = stuff.endAngle;
    if (endAngle < startAngle) {
      endAngle += Math.PI * 2;
    }
    var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
    var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
    var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
    drawText(c, this.text, textX, textY, textAngle, selectedObject == this);
  } else {
    var textX = (stuff.startX + stuff.endX) / 2;
    var textY = (stuff.startY + stuff.endY) / 2;
    var textAngle = Math.atan2(
      stuff.endX - stuff.startX,
      stuff.startY - stuff.endY,
    );
    drawText(
      c,
      this.text,
      textX,
      textY,
      textAngle + this.lineAngleAdjust,
      selectedObject == this,
    );
  }
};

Link.prototype.containsPoint = function (x, y) {
  var stuff = this.getEndPointsAndCircle();
  if (stuff.hasCircle) {
    var dx = x - stuff.circleX;
    var dy = y - stuff.circleY;
    var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
    if (Math.abs(distance) < hitTargetPadding) {
      var angle = Math.atan2(dy, dx);
      var startAngle = stuff.startAngle;
      var endAngle = stuff.endAngle;
      if (stuff.isReversed) {
        var temp = startAngle;
        startAngle = endAngle;
        endAngle = temp;
      }
      if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
      }
      if (angle < startAngle) {
        angle += Math.PI * 2;
      } else if (angle > endAngle) {
        angle -= Math.PI * 2;
      }
      return angle > startAngle && angle < endAngle;
    }
  } else {
    var dx = stuff.endX - stuff.startX;
    var dy = stuff.endY - stuff.startY;
    var length = Math.sqrt(dx * dx + dy * dy);
    var percent =
      (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
    var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
    return percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding;
  }
  return false;
};

var globalCounter = 0;

function Node(x, y) {
  this.x = x;
  this.y = y;
  this.mouseOffsetX = 0;
  this.mouseOffsetY = 0;
  this.isAcceptState = false;
  this.text = "";

  // Additional properties for LaTeX export
  this.isInitial = false; // Indicates initial state

  this.id = "" + globalCounter++; // Name identifier for the state
}

Node.prototype.setMouseStart = function (x, y) {
  this.mouseOffsetX = this.x - x;
  this.mouseOffsetY = this.y - y;
};

Node.prototype.setAnchorPoint = function (x, y) {
  this.x = x + this.mouseOffsetX;
  this.y = y + this.mouseOffsetY;
};

Node.prototype.draw = function (c) {
  // Set fill style based on selectedColor
  if (selectedColor == "style1") {
    normalColor = "blue";
    acceptColor = "green";
    initialColor = "blue";
    textColor = "white";
  } else if (selectedColor == "style2") {
    normalColor = "red";
    acceptColor = "orange";
    initialColor = "red";
    textColor = "white";
  } else {
    selectedColor = "default";
    normalColor = "transparent";
    acceptColor = "transparent";
    initialColor = "transparent";
    textColor = "black";
  }

  if (this.isAcceptState) {
    c.fillStyle = acceptColor;
  } else if (this.isInitial) {
    c.fillStyle = initialColor;
  } else {
    c.fillStyle = normalColor;
  }

  // Draw the circle
  c.beginPath();
  if (selectedColor != "default") {
    c.strokeStyle = c.fillStyle;
  }
  c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
  c.fill();
  c.stroke();

  c.fillStyle = textColor;

  // draw the text
  drawText(c, this.text, this.x, this.y, null, selectedObject == this);

  // draw a double circle for an accept state
  if (this.isAcceptState && selectedColor === "default") {
    c.beginPath();
    c.arc(this.x, this.y, nodeRadius - 6, 0, 2 * Math.PI, false);
    c.stroke();
  }

  // write text for initial state
  if (this.isInitial) {
    c.fillStyle = "black";
    drawText(c, "start ›", this.x - 55, this.y, null, false);
  }
};

Node.prototype.closestPointOnCircle = function (x, y) {
  var dx = x - this.x;
  var dy = y - this.y;
  var scale = Math.sqrt(dx * dx + dy * dy);
  return {
    x: this.x + (dx * nodeRadius) / scale,
    y: this.y + (dy * nodeRadius) / scale,
  };
};

Node.prototype.containsPoint = function (x, y) {
  return (
    (x - this.x) * (x - this.x) + (y - this.y) * (y - this.y) <
    nodeRadius * nodeRadius
  );
};

function SelfLink(node, mouse) {
  this.node = node;
  this.anchorAngle = 0;
  this.mouseOffsetAngle = 0;
  this.text = "";

  if (mouse) {
    this.setAnchorPoint(mouse.x, mouse.y);
  }
}

SelfLink.prototype.setMouseStart = function (x, y) {
  this.mouseOffsetAngle =
    this.anchorAngle - Math.atan2(y - this.node.y, x - this.node.x);
};

SelfLink.prototype.setAnchorPoint = function (x, y) {
  this.anchorAngle =
    Math.atan2(y - this.node.y, x - this.node.x) + this.mouseOffsetAngle;

  // Convert the angle to degrees for easier calculation
  var angleInDegrees = this.anchorAngle * (180 / Math.PI);

  // Snap to 0, 90, 180, 270 degrees
  var snappedAngle = Math.round(angleInDegrees / 90) * 90;

  // Convert back to radians
  this.anchorAngle = snappedAngle * (Math.PI / 180);

  // Normalize the angle to be in the range -pi to pi
  if (this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
  if (this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
};

SelfLink.prototype.getEndPointsAndCircle = function () {
  var circleX = this.node.x + 1.5 * nodeRadius * Math.cos(this.anchorAngle);
  var circleY = this.node.y + 1.5 * nodeRadius * Math.sin(this.anchorAngle);
  var circleRadius = 0.75 * nodeRadius;
  var startAngle = this.anchorAngle - Math.PI * 0.8;
  var endAngle = this.anchorAngle + Math.PI * 0.8;
  var startX = circleX + circleRadius * Math.cos(startAngle);
  var startY = circleY + circleRadius * Math.sin(startAngle);
  var endX = circleX + circleRadius * Math.cos(endAngle);
  var endY = circleY + circleRadius * Math.sin(endAngle);
  return {
    hasCircle: true,
    startX: startX,
    startY: startY,
    endX: endX,
    endY: endY,
    startAngle: startAngle,
    endAngle: endAngle,
    circleX: circleX,
    circleY: circleY,
    circleRadius: circleRadius,
  };
};

SelfLink.prototype.draw = function (c) {
  var stuff = this.getEndPointsAndCircle();
  // draw arc
  c.beginPath();
  c.arc(
    stuff.circleX,
    stuff.circleY,
    stuff.circleRadius,
    stuff.startAngle,
    stuff.endAngle,
    false,
  );
  c.stroke();
  // draw the text on the loop farthest from the node
  var textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
  var textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
  drawText(
    c,
    this.text,
    textX,
    textY,
    this.anchorAngle,
    selectedObject == this,
  );
  // draw the head of the arrow
  drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);
};

SelfLink.prototype.containsPoint = function (x, y) {
  var stuff = this.getEndPointsAndCircle();
  var dx = x - stuff.circleX;
  var dy = y - stuff.circleY;
  var distance = Math.sqrt(dx * dx + dy * dy) - stuff.circleRadius;
  return Math.abs(distance) < hitTargetPadding;
};

function TemporaryLink(from, to) {
  this.from = from;
  this.to = to;
}

TemporaryLink.prototype.draw = function (c) {
  // draw the line
  c.beginPath();
  c.moveTo(this.to.x, this.to.y);
  c.lineTo(this.from.x, this.from.y);
  c.stroke();

  // draw the head of the arrow
  drawArrow(
    c,
    this.to.x,
    this.to.y,
    Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x),
  );
};

function saveAsJSON() {
  var data = createBackup();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function uploadJSON() {
  if (
    confirm(
      "Are you sure you want to upload this JSON? This action will clear all current nodes.",
    )
  ) {
    const input = document.getElementById("fileInput");
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      clearAll((noAlert = true));
      reader.onload = function (event) {
        const data = JSON.parse(event.target.result);
        console.log(data);
        restoreBackup(data);
        draw();
        input.value = "";
      };
      reader.readAsText(file);
    }
  }
}

function restoreBackup(backupData) {
  console.log("HERE 1");
  if (!localStorage || !JSON) {
    return;
  }
  console.log("HERE 2");

  try {
    console.log("HERE 3");
    var backup = backupData ? backupData : JSON.parse(localStorage["fsm"]);
    console.log(backup);
    console.log("HERE 4");

    selectedColor = backup.style;
    globalCounter = backup.globalCounter;

    for (var i = 0; i < backup.nodes.length; i++) {
      var backupNode = backup.nodes[i];
      var node = new Node(backupNode.x, backupNode.y);
      node.isAcceptState = backupNode.isAcceptState;
      node.isInitial = backupNode.isInitial;
      node.text = backupNode.text;
      node.id = backupNode.id;
      nodes.push(node);
    }

    for (var i = 0; i < backup.links.length; i++) {
      var backupLink = backup.links[i];
      var link = null;
      if (backupLink.type == "SelfLink") {
        link = new SelfLink(nodes[backupLink.node]);
        link.anchorAngle = backupLink.anchorAngle;
        link.text = backupLink.text;
      } else if (backupLink.type == "StartLink") {
        link = new StartLink(nodes[backupLink.node]);
        link.deltaX = backupLink.deltaX;
        link.deltaY = backupLink.deltaY;
        link.text = backupLink.text;
      } else if (backupLink.type == "Link") {
        link = new Link(nodes[backupLink.nodeA], nodes[backupLink.nodeB]);
        link.parallelPart = backupLink.parallelPart;
        link.perpendicularPart = backupLink.perpendicularPart;
        link.text = backupLink.text;
        link.lineAngleAdjust = backupLink.lineAngleAdjust;
      }
      if (link != null) {
        links.push(link);
      }
    }
  } catch (e) {
    localStorage["fsm"] = "";
  }
}

function createBackup() {
  var backup = {
    nodes: [],
    links: [],
    style: selectedColor,
    globalCounter: globalCounter,
  };
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var backupNode = {
      x: node.x,
      y: node.y,
      text: node.text,
      isAcceptState: node.isAcceptState,
      id: node.id,
      isInitial: node.isInitial,
    };
    backup.nodes.push(backupNode);
  }
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var backupLink = null;
    if (link instanceof SelfLink) {
      backupLink = {
        type: "SelfLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        anchorAngle: link.anchorAngle,
      };
    } else if (link instanceof StartLink) {
      backupLink = {
        type: "StartLink",
        node: nodes.indexOf(link.node),
        text: link.text,
        deltaX: link.deltaX,
        deltaY: link.deltaY,
      };
    } else if (link instanceof Link) {
      backupLink = {
        type: "Link",
        nodeA: nodes.indexOf(link.nodeA),
        nodeB: nodes.indexOf(link.nodeB),
        text: link.text,
        lineAngleAdjust: link.lineAngleAdjust,
        parallelPart: link.parallelPart,
        perpendicularPart: link.perpendicularPart,
      };
    }
    if (backupLink != null) {
      backup.links.push(backupLink);
    }
  }
  return backup;
}

function saveBackup() {
  if (!localStorage || !JSON) {
    return;
  }

  backup = createBackup();

  localStorage["fsm"] = JSON.stringify(backup);
}

function det(a, b, c, d, e, f, g, h, i) {
  return a * e * i + b * f * g + c * d * h - a * f * h - b * d * i - c * e * g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
  var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
  var bx = -det(
    x1 * x1 + y1 * y1,
    y1,
    1,
    x2 * x2 + y2 * y2,
    y2,
    1,
    x3 * x3 + y3 * y3,
    y3,
    1,
  );
  var by = det(
    x1 * x1 + y1 * y1,
    x1,
    1,
    x2 * x2 + y2 * y2,
    x2,
    1,
    x3 * x3 + y3 * y3,
    x3,
    1,
  );
  var c = -det(
    x1 * x1 + y1 * y1,
    x1,
    y1,
    x2 * x2 + y2 * y2,
    x2,
    y2,
    x3 * x3 + y3 * y3,
    x3,
    y3,
  );
  return {
    x: -bx / (2 * a),
    y: -by / (2 * a),
    radius: Math.sqrt(bx * bx + by * by - 4 * a * c) / (2 * Math.abs(a)),
  };
}

function fixed(number, digits) {
  return number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

var greekLetterNames = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
  "Nu",
  "Xi",
  "Omicron",
  "Pi",
  "Rho",
  "Sigma",
  "Tau",
  "Upsilon",
  "Phi",
  "Chi",
  "Psi",
  "Omega",
];

function convertLatexShortcuts(text) {
  // html greek characters
  for (var i = 0; i < greekLetterNames.length; i++) {
    var name = greekLetterNames[i];
    text = text.replace(
      new RegExp("\\\\" + name, "g"),
      String.fromCharCode(913 + i + (i > 16)),
    );
    text = text.replace(
      new RegExp("\\\\" + name.toLowerCase(), "g"),
      String.fromCharCode(945 + i + (i > 16)),
    );
  }

  // subscripts
  text = text.replace(/_({[^}]*})/g, function (match, p1) {
    return p1
      .substring(1, p1.length - 1) // Remove curly braces
      .split("")
      .map((char) => {
        var code = char.charCodeAt(0);
        return code >= 48 && code <= 57 // Check if character is a digit
          ? String.fromCharCode(8320 + code - 48) // Convert to subscript
          : char; // Keep non-digit characters unchanged
      })
      .join("");
  });

  // Single digit subscripts without curly braces
  text = text.replace(/_([0-9])/g, function (match, p1) {
    return String.fromCharCode(8320 + Number(p1));
  });

  var latexSymbols = {
    "\\\\rightarrow": "\u2192", // Unicode for right arrow
    "\\\\leftarrow": "\u2190", // Unicode for left arrow
    "\\\\emptyset": "\u2205", // Unicode for empty set
    "\\\\sqcup": "\u2294", // Unicode for square union
    "\\\\textvisiblespace": "\u2423", // Unicode for visible space
    "\\\\infty": "\u221E", // Unicode for infinity
    "\\\\vdash": "\u22A2",  // Unicode for right tack (used to denote that a configuration yields another)
    "\\\\dashv": "\u22A3",  // Unicode for left tack (used for reverse transitions)
    "\\\\blank": "\u2423",  // Shortcut for a visible space
  };

  for (var key in latexSymbols) {
    if (latexSymbols.hasOwnProperty(key)) {
      text = text.replace(new RegExp(key, "g"), latexSymbols[key]);
    }
  }

  return text;
}

function textToXML(text) {
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  var result = "";
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c >= 0x20 && c <= 0x7e) {
      result += text[i];
    } else {
      result += "&#" + c + ";";
    }
  }
  return result;
}

function drawArrow(c, x, y, angle) {
  var dx = Math.cos(angle);
  var dy = Math.sin(angle);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
  c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
  c.fill();
}

function canvasHasFocus() {
  return (document.activeElement || document.body) == document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected) {
  text = convertLatexShortcuts(originalText);
  c.font = '20px "Times New Roman", serif';
  var width = c.measureText(text).width;

  // center the text
  x -= width / 2;

  // position the text intelligently if given an angle
  if (angleOrNull != null) {
    var cos = Math.cos(angleOrNull);
    var sin = Math.sin(angleOrNull);
    var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
    var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
    var slide =
      sin * Math.pow(Math.abs(sin), 40) * cornerPointX -
      cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
    x += cornerPointX - sin * slide;
    y += cornerPointY + cos * slide;
  }

  // draw text and caret (round the coordinates so the caret falls on a pixel)
  if ("advancedFillText" in c) {
    c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
  } else {
    x = Math.round(x);
    y = Math.round(y);
    c.fillText(text, x, y + 6);
    if (isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
      x += width;
      c.beginPath();
      c.moveTo(x, y - 10);
      c.lineTo(x, y + 10);
      c.stroke();
    }
  }
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
  clearInterval(caretTimer);
  caretTimer = setInterval("caretVisible = !caretVisible; draw()", 500);
  caretVisible = true;
}

var canvas;
var nodeRadius = 30;
var nodes = [];
var links = [];

var cursorVisible = true;
var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false;
var originalClick;

function drawUsing(c) {
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.translate(0.5, 0.5); // For crisp lines

  if (typeof c.scale === "function") {
    var scale = 2; // Adjust the scale factor based on your new canvas resolution
    c.scale(scale, scale); // Apply scaling
  }

  for (var i = 0; i < nodes.length; i++) {
    c.lineWidth = 1;
    c.fillStyle = c.strokeStyle = nodes[i] == selectedObject ? "blue" : "black";
    nodes[i].draw(c);
  }
  for (var i = 0; i < links.length; i++) {
    c.lineWidth = 1;
    c.fillStyle = c.strokeStyle = links[i] == selectedObject ? "blue" : "black";
    links[i].draw(c);
  }
  if (currentLink != null) {
    c.lineWidth = 1;
    c.fillStyle = c.strokeStyle = "black";
    currentLink.draw(c);
  }

  c.restore();
}

function draw() {
  drawUsing(canvas.getContext("2d"));
  saveBackup();
}

function selectObject(x, y) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].containsPoint(x, y)) {
      return nodes[i];
    }
  }
  for (var i = 0; i < links.length; i++) {
    if (links[i].containsPoint(x, y)) {
      return links[i];
    }
  }
  return null;
}

function snapNode(node) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] == node) continue;

    if (Math.abs(node.x - nodes[i].x) < snapToPadding) {
      node.x = nodes[i].x;
    }

    if (Math.abs(node.y - nodes[i].y) < snapToPadding) {
      node.y = nodes[i].y;
    }
  }
}

window.onload = function () {
  canvas = document.getElementById("canvas");
  restoreBackup();
  draw();

  canvas.onmousedown = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);
    selectedObject = selectObject(mouse.x, mouse.y);
    movingObject = false;
    originalClick = mouse;

    if (selectedObject != null) {
      if (shift && selectedObject instanceof Node) {
        currentLink = new SelfLink(selectedObject, mouse);
      } else {
        movingObject = true;
        deltaMouseX = deltaMouseY = 0;
        if (selectedObject.setMouseStart) {
          selectedObject.setMouseStart(mouse.x, mouse.y);
        }
      }
      resetCaret();
    } else if (shift) {
      currentLink = new TemporaryLink(mouse, mouse);
    }

    draw();

    if (canvasHasFocus()) {
      // disable drag-and-drop only if the canvas is already focused
      return false;
    } else {
      // otherwise, let the browser switch the focus away from wherever it was
      resetCaret();
      return true;
    }
  };

  canvas.ondblclick = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);
    selectedObject = selectObject(mouse.x, mouse.y);

    if (selectedObject == null) {
      selectedObject = new Node(mouse.x, mouse.y);
      nodes.push(selectedObject);
      resetCaret();
      draw();
    } else if (selectedObject instanceof Node) {
      selectedObject.isAcceptState = !selectedObject.isAcceptState;
      draw();
    }
  };

  canvas.onmousemove = function (e) {
    var mouse = crossBrowserRelativeMousePos(e);

    if (currentLink != null) {
      var targetNode = selectObject(mouse.x, mouse.y);
      if (!(targetNode instanceof Node)) {
        targetNode = null;
      }

      if (selectedObject == null) {
        if (targetNode != null) {
          // currentLink = new StartLink(targetNode, originalClick);
        } else {
          currentLink = new TemporaryLink(originalClick, mouse);
        }
      } else {
        if (targetNode == selectedObject) {
          currentLink = new SelfLink(selectedObject, mouse);
        } else if (targetNode != null) {
          currentLink = new Link(selectedObject, targetNode);
        } else {
          currentLink = new TemporaryLink(
            selectedObject.closestPointOnCircle(mouse.x, mouse.y),
            mouse,
          );
        }
      }
      draw();
    }

    if (movingObject) {
      selectedObject.setAnchorPoint(mouse.x, mouse.y);
      if (selectedObject instanceof Node) {
        snapNode(selectedObject);
      }
      draw();
    }
  };

  canvas.onmouseup = function (e) {
    movingObject = false;

    if (currentLink != null) {
      if (!(currentLink instanceof TemporaryLink)) {
        selectedObject = currentLink;
        links.push(currentLink);
        resetCaret();
      }
      currentLink = null;
      draw();
    }
  };
};

var shift = false;

document.onkeydown = function (e) {
  var key = crossBrowserKey(e);

  if (key == 16) {
    shift = true;
  } else if (!canvasHasFocus()) {
    // don't read keystrokes when other things have focus
    return true;
  } else if (key == 8) {
    // backspace key
    if (selectedObject != null && "text" in selectedObject) {
      selectedObject.text = selectedObject.text.substr(
        0,
        selectedObject.text.length - 1,
      );
      resetCaret();
      draw();
    }

    // backspace is a shortcut for the back button, but do NOT want to change pages
    return false;
  } else if (key == 46) {
    // delete key
    if (selectedObject != null) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] == selectedObject) {
          nodes.splice(i--, 1);
        }
      }
      for (var i = 0; i < links.length; i++) {
        if (
          links[i] == selectedObject ||
          links[i].node == selectedObject ||
          links[i].nodeA == selectedObject ||
          links[i].nodeB == selectedObject
        ) {
          links.splice(i--, 1);
        }
      }
      selectedObject = null;
      draw();
    }
  } else if (key == 13) {
    // enter key
    if (selectedObject != null) {
      selectedObject.isInitial = !selectedObject.isInitial;
      draw();
    }
  }
};

document.onkeyup = function (e) {
  var key = crossBrowserKey(e);

  if (key == 16) {
    shift = false;
  }
};

document.onkeypress = function (e) {
  // don't read keystrokes when other things have focus
  var key = crossBrowserKey(e);
  if (!canvasHasFocus()) {
    // don't read keystrokes when other things have focus
    return true;
  } else if (
    key >= 0x20 &&
    key <= 0x7e &&
    !e.metaKey &&
    !e.altKey &&
    !e.ctrlKey &&
    selectedObject != null &&
    "text" in selectedObject
  ) {
    selectedObject.text += String.fromCharCode(key);
    resetCaret();
    draw();

    // don't let keys do their actions (like space scrolls down the page)
    return false;
  } else if (key == 8) {
    // backspace is a shortcut for the back button, but do NOT want to change pages
    return false;
  }
};

function crossBrowserKey(e) {
  e = e || window.event;
  return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
  e = e || window.event;
  var obj = e.target || e.srcElement;
  var x = 0,
    y = 0;
  while (obj.offsetParent) {
    x += obj.offsetLeft;
    y += obj.offsetTop;
    obj = obj.offsetParent;
  }
  return { x: x, y: y };
}

function crossBrowserMousePos(e) {
  e = e || window.event;
  return {
    x:
      e.pageX ||
      e.clientX +
        document.body.scrollLeft +
        document.documentElement.scrollLeft,
    y:
      e.pageY ||
      e.clientY + document.body.scrollTop + document.documentElement.scrollTop,
  };
}

function crossBrowserRelativeMousePos(e) {
  var element = crossBrowserElementPos(e);
  var mouse = crossBrowserMousePos(e);
  return {
    x: mouse.x - element.x,
    y: mouse.y - element.y,
  };
}

function output(text) {
  var element = document.getElementById("output");
  element.style.display = "block";
  element.value = text;
}

function saveAsPNG() {
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(canvas.getContext("2d"));
  selectedObject = oldSelectedObject;

  var pngData = canvas.toDataURL("image/png");

  // Create a temporary link to trigger download
  var downloadLink = document.createElement("a");
  downloadLink.href = pngData;
  downloadLink.download = "canvas.png"; // Name the download file

  // Append link to the body, click it, and then remove it
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function saveAsSVG() {
  var exporter = new ExportAsSVG();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(exporter);
  selectedObject = oldSelectedObject;
  var svgData = exporter.toSVG();
  output(svgData);
  // Chrome isn't ready for this yet, the 'Save As' menu item is disabled
  // document.location.href = 'data:image/svg+xml;base64,' + btoa(svgData);
}

function saveAsLaTeX() {
  var exporter = new ExportAsLaTeX();
  var oldSelectedObject = selectedObject;
  selectedObject = null;
  drawUsing(exporter);
  selectedObject = oldSelectedObject;
  var texData = exporter.toLaTeX();
  output(texData);

  document.getElementById("copyToClipboard").style.display = "inline-block";
  document.getElementById("saveAsTex").style.display = "inline-block";
}
