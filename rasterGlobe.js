      // Select the canvas from the document.
      var canvas = document.querySelector("canvas");
      var mousePos;
      var mouseDown = 0;
      var rotationOn = true;

      var div = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);

      // Create the WebGL context, with fallback for experimental support.
      var context = canvas.getContext("webgl")
          || canvas.getContext("experimental-webgl");

      // Compile the vertex shader.
      var vertexShader = context.createShader(context.VERTEX_SHADER);
      context.shaderSource(vertexShader, document.querySelector("#vertex-shader").textContent);
      context.compileShader(vertexShader);
      if (!context.getShaderParameter(vertexShader, context.COMPILE_STATUS)) throw new Error(context.getShaderInfoLog(vertexShader));

      // Compile the fragment shader.
      var fragmentShader = context.createShader(context.FRAGMENT_SHADER);
      context.shaderSource(fragmentShader, document.querySelector("#fragment-shader").textContent);
      context.compileShader(fragmentShader);
      if (!context.getShaderParameter(fragmentShader, context.COMPILE_STATUS)) throw new Error(context.getShaderInfoLog(fragmentShader));

      // Link and use the program.
      var program = context.createProgram();
      context.attachShader(program, vertexShader);
      context.attachShader(program, fragmentShader);
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error(context.getProgramInfoLog(program));
      context.useProgram(program);

      // Define the positions (as vec2) of the square that covers the canvas.
      var positionBuffer = context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
      context.bufferData(context.ARRAY_BUFFER, new Float32Array([
          -1.0, -1.0,
          +1.0, -1.0,
          +1.0, +1.0,
          -1.0, +1.0
        ]), context.STATIC_DRAW);

      // Bind the position buffer to the position attribute.
      var positionAttribute = context.getAttribLocation(program, "a_position");
      context.enableVertexAttribArray(positionAttribute);
      context.vertexAttribPointer(positionAttribute, 2, context.FLOAT, false, 0, 0);

      // Extract the projection parameters.
      var translateUniform = context.getUniformLocation(program, "u_translate"),
          scaleUniform = context.getUniformLocation(program, "u_scale"),
          rotateUniform = context.getUniformLocation(program, "u_rotate");

      // Load the reference image.
      var image = new Image;
      image.src = "raster3.jpg";
      image.onload = readySoon;

      // SVG map declarations
      var svg = d3.select("body").append("svg");
      var projection = d3.geoOrthographic();
      var path = d3.geoPath(projection);

      var coordinates = [];
      const markerGroup = svg.append('g');

      var translateX = 0;
      var translateY = 0;
      const colorLand = '#ffffff';
      const colorWater = '#a4c7db'
      const colorMarker = '#DFF6FC'
      const colorLine = '#DFF6FC'
      const colorText = '#DFF6FC'

      d3.csv("RotatingGlobe.csv", function(data){
          for(var i = 0; i < data.length; i++){
              coordinates.push(data[i])
          }

          // drawMarkers()

      })

      document.onmousedown = function() {
          ++mouseDown;
      }
      document.onmouseup = function() {
          --mouseDown;
      }

      document.addEventListener('keyup', event => {
          if (event.code === 'Space') {
          rotationOn = !rotationOn
      }
      })

      document.onmousemove = mouseListener;

      function mouseListener (event) {
          event = event || window.event;
          mousePos = event.pageX / window.innerWidth;
      }




      // Hack to ensure correct inference of window dimensions.
      function readySoon() {
        d3.json("world.json", (error, map) => {
          if (error) throw error;

          var feature = topojson.feature(map, map.objects.countries),
              mesh = topojson.feature(map, map.objects.land);

          // run periodically
          setTimeout(() => {
            resize(feature);
            ready(feature, mesh);
          }, 10);

          self.onresize = () => resize(feature);
        });
      }

      function resize(feature) {
        var w = self.innerWidth, h = self.innerHeight;
        // var width = 800, height = width;
        var width = Math.min(w, h) * 0.8,
            height = width;

        // The canvas is absolutely positioned in order to overlay it with the SVG.
        // To get it to center, do some math.
        d3.select(canvas).style("left", ((w - width) / 2) + "px")
        .style("top", ((h - height) / 2) + "px");


        canvas.setAttribute("width", width);
        canvas.setAttribute("height", height);
        context.uniform2f(translateUniform, width / 2, height / 2);

        // Define size of the globe (raster)
        context.uniform1f(scaleUniform, height / 2);
        context.viewport(0, 0, width, height);

        // Basic D3 + TopoJSON map
        svg.attr("width", w).attr("height", h);
        projection.fitSize([w, height], feature);
      }

      function ready(feature, mesh) {
        // Create a texture and a mipmap for accurate minification.
        var texture = context.createTexture();
        context.bindTexture(context.TEXTURE_2D, texture);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR_MIPMAP_LINEAR);
        context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR); // or NEAREST

        // The current rotation and speed.
        var rotate =  [30, -30, -30],
            speed = [0.5, 0, 0];

        var speedScale = d3.scaleLinear()
            .domain([0,1])
            .range([-5,5]);


        var w = self.innerWidth, h = self.innerHeight;
        // var width = 800, height = width;
        var width = Math.min(w, h) * 0.8,
            height = width;
        var center = [w/2, h/2];

        var translateY = (h - height) / 2;

        drawGlobe()
        redraw();

        function drawGlobe(){
          var countries = svg.selectAll(".country")
              .data(feature.features);

          countries.enter().append("path")
              .attr("class", "country")
            .merge(countries)
              .attr("d", path)
              .style("stroke", "FFFFFF")
              .style("stroke-width", "1px")
              // .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

          var boundaries = svg.selectAll(".boundary")
              .data([mesh])
              // .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

          boundaries.enter().append("path")
              .attr("class", "boundary")
              .merge(boundaries)
              .attr("d", path)
              .style("stroke", "#000066")
              .style("stroke-width", "1px")
              // .attr("transform", "translate(" + translateX + ", "+ translateY + ")");
        }


        // Rotate and redraw!
        function redraw() {
            var speedMultiplier = 1;
            if(mouseDown){
                speedMultiplier = speedScale(mousePos)
            }
            rotate = rotate.map(function(d, i){
                var rSpeed;
                if(mouseDown){
                    rSpeed = d + speedMultiplier * speed[i]
                } else if (rotationOn) {
                    rSpeed = d + speedMultiplier * speed[i]
                } else {
                    rSpeed = d
                }
            return d = rSpeed;
          });
          // rotate = rotate.map(d => d += speed.i);

          context.uniform3fv(rotateUniform, rotate); // Three-axis rotation
          context.bindTexture(context.TEXTURE_2D, texture); // XXX Safari
          context.drawArrays(context.TRIANGLE_FAN, 0, 4);
          requestAnimationFrame(redraw);

          projection.rotate(rotate);


        svg.selectAll("path")
        .attr("d", path)
        .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

        svg.selectAll("text")
            .attr("x", d => projection([d.longitude, d.latitude])[0])
            .attr("y", d => projection([d.longitude, d.latitude])[1] - 30)
            // .style("font-size", 20)
            .attr("text-anchor", "middle")
            .attr('fill', d => {
                const coordinate = [d.longitude, d.latitude];
                gdistance = d3.geoDistance(coordinate, projection.invert(center));
                return gdistance > 1.57 ? 'none' : colorText;
            })
            .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

        svg.selectAll("line")
            .attr('x1', d => projection([d.longitude, d.latitude])[0])
            .attr('y1', d => projection([d.longitude, d.latitude])[1])
            .attr('x2', d => projection([d.longitude, d.latitude])[0])
            .attr('y2', d => projection([d.longitude, d.latitude])[1] - 30)
            .attr('stroke', d => {
                const coordinate = [d.longitude, d.latitude];
                gdistance = d3.geoDistance(coordinate, projection.invert(center));
                return gdistance > 1.57 ? 'none' : colorLine;
            })
            .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

        d3.selectAll("circle")
          .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

          drawMarkers();
        }
      }

      // A polyfill for requestAnimationFrame.
      // if (!self.requestAnimationFrame) requestAnimationFrame =
      //     self.webkitRequestAnimationFrame
      //     || self.mozRequestAnimationFrame
      //     || self.msRequestAnimationFrame
      //     || self.oRequestAnimationFrame
      //     || function(f) { setTimeout(f, 17); };

function drawMarkers() {

          var w = self.innerWidth, h = self.innerHeight;
        // var width = 800, height = width;
        var width = Math.min(w, h) * 0.8,
            height = width;
        var center = [w/2, h/2];
    var markers = markerGroup.selectAll('circle')
        .data(coordinates);

    var ctext = markerGroup.selectAll('text')
        .data(coordinates)
        .enter()
        .append("text")
        // .merge(ctext)
        .attr("class", "text")
        .text(function(d,i){
            return d.title
        })
        .attr("font-family", "Helvetica")
        .attr("x", d => projection([d.longitude, d.latitude])[0])
        .attr("y", d => projection([d.longitude, d.latitude])[1])
        .attr("transform", "translate(" + translateX + ", "+ translateY + ")");


    markers.enter()
        .append('line')
        .attr('x1', d => projection([d.longitude, d.latitude])[0])
        .attr('y1', d => projection([d.longitude, d.latitude])[1])
        .attr('x2', d => projection([d.longitude, d.latitude])[0])
        .attr('y2', d => projection([d.longitude, d.latitude])[1] + d3.randomUniform(3, 15))
        .attr('stroke', colorLine)
        .attr("transform", "translate(" + translateX + ", "+ translateY + ")");

    markers.enter()
        .append('circle')
        .attr("class", "circle")
        .merge(markers)
        .attr('cx', d => projection([d.longitude, d.latitude])[0])
        .attr('cy', d => projection([d.longitude, d.latitude])[1])
        .attr('fill', '#888')
        .attr('fill', d => {
            const coordinate = [d.longitude, d.latitude];
            gdistance = d3.geoDistance(coordinate, projection.invert(center));
            return gdistance > 1.57 ? 'none' : colorMarker;
        })
        .attr('r', 5)
        .on("mouseover", function(d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);
            div.html(d.description + " <br/>")
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);
        });



    markerGroup.each(function () {
        this.parentNode.appendChild(this);
    });
}
