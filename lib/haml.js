//https://github.com/creationix/haml-js
//tangoboy mod

;(function (HOST) {

  var matchers, self_close_tags, embedder, forceXML, escaperName, escapeHtmlByDefault;


  var trim = function(text){
    return (text || "").replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "" );
  };


  var foreach = function(arr,call){
    for (var i = 0; i < arr.length; i++) {
      (call||function(){}).call(arr[i],arr[i],i);
    }
  };

  var map = function(arr,call,thisp){
    var res = [];
    res.length = arr.length;
    for (var i = 0; i < arr.length; i++) {
      if(i in arr){
        res[i] = (call||function(){}).call(thisp||arr[i], arr[i], i, arr);
      }
    }
    return res;
  };

  var filter = function(arr,call,thisp){
    var res = [];
    for (var i = 0; i < arr.length; i++) {
      if(i in arr){
        var val = arr[i];
        if((call||function(){}).call(thisp||val, val, i, arr)){
            res.push(val);
        }
      }
    }
    return res;
  };


  var indexOf = function(arr,elt,from){
    var len = arr.length;
    var from = Number(from) || 0;
    from = (from < 0)
        ? Math.ceil(from)
        : Math.floor(from);
    if (from < 0)
        from += len;

    for (; from < len; from++)
    {
        if (from in arr && arr[from] === elt)
            return from;
    }
    return -1;
  };


  function html_escape(text) {
    return (text + "").
      replace(/&/g, "&amp;").
      replace(/</g, "&lt;").
      replace(/>/g, "&gt;").
      replace(/\"/g, "&quot;");
  }

  function render_attribs(attribs) {
    var key, value, result = [];
    for (key in attribs) {
      if (key !== '_content' && attribs.hasOwnProperty(key)) {
        switch (attribs[key]) {
        case 'undefined':
        case 'false':
        case 'null':
        case '""':
          break;
        default:
          try {
            value = JSON.parse("[" + attribs[key] +"]")[0];
            if (value === true) {
              value = key;
            } else if (typeof value === 'string' && embedder.test(value)) {
              value = '" +\r\n' + parse_interpol(html_escape(value)) + ' +\r\n"';
            } else {
              value = html_escape(value);
            }
            result.push(" " + key + '=\\"' + value + '\\"');
          } catch (e) {
            result.push(" " + key + '=\\"" + '+escaperName+'(' + attribs[key] + ') + "\\"');
          }
        }
      }
    }
    return result.join("");
  }

  // Parse the attribute block using a state machine
  function parse_attribs(line) {
    var attributes = {},
        l = line.length,
        i, c,
        count = 1,
        quote = false,
        skip = false,
        open, close, joiner, seperator,
        pair = {
          start: 1,
          middle: null,
          end: null
        };

    if (!(l > 0 && (line.charAt(0) === '{' || line.charAt(0) === '('))) {
      return {
        _content: line[0] === ' ' ? line.substr(1, l) : line
      };
    }
    open = line.charAt(0);
    close = (open === '{') ? '}' : ')';
    joiner = (open === '{') ? ':' : '=';
    seperator = (open === '{') ? ',' : ' ';

    function process_pair() {
      if (typeof pair.start === 'number' &&
          typeof pair.middle === 'number' &&
          typeof pair.end === 'number') {
        var key = trim( line.substr(pair.start, pair.middle - pair.start) ),
            value = trim( line.substr(pair.middle + 1, pair.end - pair.middle - 1) );
        attributes[key] = value;
      }
      pair = {
        start: null,
        middle: null,
        end: null
      };
    }

    for (i = 1; count > 0; i += 1) {

      // If we reach the end of the line, then there is a problem
      if (i > l) {
        throw "Malformed attribute block";
      }

      c = line.charAt(i);
      if (skip) {
        skip = false;
      } else {
        if (quote) {
          if (c === '\\') {
            skip = true;
          }
          if (c === quote) {
            quote = false;
          }
        } else {
          if (c === '"' || c === "'") {
            quote = c;
          }

          if (count === 1) {
            if (c === joiner) {
              pair.middle = i;
            }
            if (c === seperator || c === close) {
              pair.end = i;
              process_pair();
              if (c === seperator) {
                pair.start = i + 1;
              }
            }
          }

          if (c === open || c === "(") {
            count += 1;
          }
          if (c === close || (count > 1 && c === ")")) {
            count -= 1;
          }
        }
      }
    }
    attributes._content = line.substr(i, line.length);
    return attributes;
  }

  // Split interpolated strings into an array of literals and code fragments.
  function parse_interpol(value) {
    var items = [],
        pos = 0,
        next = 0,
        match;
    while (true) {
      // Match up to embedded string
      next = value.substr(pos).search(embedder);
      if (next < 0) {
        if (pos < value.length) {
          items.push(JSON.stringify(value.substr(pos)));
        }
        break;
      }
      items.push(JSON.stringify(value.substr(pos, next)));
      pos += next;

      // Match embedded string
      match = value.substr(pos).match(embedder);
      next = match[0].length;
      if (next < 0) { break; }
      if(match[1] === "#"){
        items.push("_$tpl(\""+(match[2] || match[3])+"\")");//escaperName
      }else{
        //unsafe!!!
        items.push(match[2] || match[3]);
      }
      
      pos += next;
    }
    return filter(items, function (part) { return part && part.length > 0}).join(" +\r\n");
  }

  // Used to find embedded code in interpolated strings.
  embedder = /([#!])\{([^}]*)\}/;

  self_close_tags = ["meta", "img", "link", "br", "hr", "input", "area", "base"];

  // All matchers' regexps should capture leading whitespace in first capture
  // and trailing content in last capture
  matchers = [
    // html tags
    {
      name: "html tags",
      regexp: /^(\s*)((?:[.#%][a-z_\-][a-z0-9_:\-]*)+)(.*)$/i,
      process: function () {
        var line_beginning, tag, classes, ids, attribs, content, whitespaceSpecifier, whitespace={}, output;
        line_beginning = this.matches[2];
        classes = line_beginning.match(/\.([a-z_\-][a-z0-9_\-]*)/gi);
        ids = line_beginning.match(/\#([a-z_\-][a-z0-9_\-]*)/gi);
        tag = line_beginning.match(/\%([a-z_\-][a-z0-9_:\-]*)/gi);

        // Default to <div> tag
        tag = tag ? tag[0].substr(1, tag[0].length) : 'div';

        attribs = this.matches[3];
        if (attribs) {
          attribs = parse_attribs(attribs);
          if (attribs._content) {
            var leader0 = attribs._content.charAt(0),
                leader1 = attribs._content.charAt(1),
                leaderLength = 0;
                
            if(leader0 == "<"){
              leaderLength++;
              whitespace.inside = true;
              if(leader1 == ">"){
                leaderLength++;
                whitespace.around = true;
              }
            }else if(leader0 == ">"){
              leaderLength++;
              whitespace.around = true;
              if(leader1 == "<"){
                leaderLength++;
                whitespace.inside = true;
              }
            }
            attribs._content = attribs._content.substr(leaderLength);
            //once we've identified the tag and its attributes, the rest is content.
            // this is currently trimmed for neatness.
            this.contents.unshift(trim( attribs._content ));
            delete(attribs._content);
          }
        } else {
          attribs = {};
        }

        if (classes) {
          classes = map(classes, function (klass) {
            return klass.substr(1, klass.length);
          }).join(' ');



          if (attribs['class']) {
            try {
              attribs['class'] = JSON.stringify(classes + " " + JSON.parse(attribs['class']));
            } catch (e) {
              attribs['class'] = JSON.stringify(classes + " ") + " + " + attribs['class'];
            }
          } else {
            attribs['class'] = JSON.stringify(classes);
          }
        }
        if (ids) {
          ids = map(ids, function (id) {
            return id.substr(1, id.length);
          }).join(' ');


          if (attribs.id) {
            attribs.id = JSON.stringify(ids + " ") + attribs.id;
          } else {
            attribs.id = JSON.stringify(ids);
          }
        }

        attribs = render_attribs(attribs);

        content = this.render_contents();
        if (content === '""') {
          content = '';
        }
        
        if(whitespace.inside){
          if(content.length==0){
            content='"  "'
          }else{
            try{ //remove quotes if they are there
              content = '" '+JSON.parse(content)+' "';
            }catch(e){
              content = '" "+\r\n'+content+'+\r\n" "';
            }            
          }
        }

        if (forceXML ? content.length > 0 : indexOf(self_close_tags, tag) == -1) {
          output = '"<' + tag + attribs + '>\\r\\n"' +
            (content.length > 0 ? ' + \r\n' + content : "") +
            ' + \r\n"</' + tag + '>\\r\\n"';
        } else {
          output = '"<' + tag + attribs + ' />\\r\\n"';
        }
        
        if(whitespace.around){
          //output now contains '"<b>hello</b>"'
          //we need to crack it open to insert whitespace.
          output = '" '+output.substr(1, output.length - 2)+' "';
        }

        return output;
      }
    },

    // each loops
    {
      name: "each loop",
      regexp: /^(\s*)(?::for|:each)\s+(?:([a-z_][a-z_\-]*),\s*)?([a-z_][a-z_\-]*)\s+in\s+(.*)(\s*)$/i,
      process: function () {
        var ivar = this.matches[2] || '__key__', // index
            vvar = this.matches[3],              // value
            avar = this.matches[4],              // array
            rvar = '__result__';                 // results

        if (this.matches[5]) {
          this.contents.unshift(this.matches[5]);
        }
        return '(function () { ' +
          'var ' + rvar + ' = [], ' + ivar + ', ' + vvar + '; ' +
          'for (' + ivar + ' in ' + avar + ') { ' +
          'if (' + avar + '.hasOwnProperty(' + ivar + ')) { ' +
          vvar + ' = ' + avar + '[' + ivar + ']; ' +
          rvar + '.push(\r\n' + (this.render_contents() || "''") + '\r\n); ' +
          '} } return ' + rvar + '.join(""); }).call(this)';
      }
    },

    // if statements
    {
      name: "if",
      regexp: /^(\s*):if\s+(.*)\s*$/i,
      process: function () {
        var condition = this.matches[2];
        return '(function () { ' +
          'if (' + condition + ') { ' +
          'return (\r\n' + (this.render_contents() || '') + '\r\n);' +
          '} else { return ""; } }).call(this)';
      }
    },
    
    // silent-comments
    {
      name: "silent-comments",
      regexp: /^(\s*)-#\s*(.*)\s*$/i,
      process: function () {
        return '""';
      }
    },
    
    //html-comments
    {
      name: "silent-comments",
      regexp: /^(\s*)\/\s*(.*)\s*$/i,
      process: function () {
        this.contents.unshift(this.matches[2]);
        
        return '"<!--'+this.contents.join('\\r\\n')+'-->"';
      }
    },
    
    // raw js
    {
      name: "rawjs",
      regexp: /^(\s*)-\s*(.*)\s*$/i,
      process: function () {
        this.contents.unshift(this.matches[2]);
        return '"";' + this.contents.join("\r\n")+"; _$output = _$output ";
      }
    },

    // raw js
    {
      name: "pre",
      regexp: /^(\s*):pre(\s+(.*)|$)/i,
      process: function () {
        this.contents.unshift(this.matches[2]);
        return '"<pre>"+\r\n' + JSON.stringify(this.contents.join("\r\n"))+'+\r\n"</pre>"';
      }
    },
    
    // declarations
    {
      name: "doctype",
      regexp: /^()!!!(?:\s*(.*))\s*$/,
      process: function () {
        var line = '';
        switch ((this.matches[2] || '').toLowerCase()) {
        case '':
          // XHTML 1.0 Transitional
          line = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
          break;
        case 'strict':
        case '1.0':
          // XHTML 1.0 Strict
          line = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';
          break;
        case 'frameset':
          // XHTML 1.0 Frameset
          line = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">';
          break;
        case '5':
          // XHTML 5
          line = '<!DOCTYPE html>';
          break;
        case '1.1':
          // XHTML 1.1
          line = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">';
          break;
        case 'basic':
          // XHTML Basic 1.1
          line = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd">';
          break;
        case 'mobile':
          // XHTML Mobile 1.2
          line = '<!DOCTYPE html PUBLIC "-//WAPFORUM//DTD XHTML Mobile 1.2//EN" "http://www.openmobilealliance.org/tech/DTD/xhtml-mobile12.dtd">';
          break;
        case 'xml':
          // XML
          line = "<?xml version='1.0' encoding='utf-8' ?>";
          break;
        case 'xml iso-8859-1':
          // XML iso-8859-1
          line = "<?xml version='1.0' encoding='iso-8859-1' ?>";
          break;
        }
        return JSON.stringify(line + "\r\n");
      }
    },

    // Embedded markdown. Needs to be added to exports externally.
    {
      name: "markdown",
      regexp: /^(\s*):markdown\s*$/i,
      process: function () {
        //Markdown module
        var converter = new Showdown.converter();
        return parse_interpol(converter.makeHtml(this.contents.join("\r\n")));
      }
    },

    // script blocks
    {
      name: "script",
      regexp: /^(\s*):(?:java)?script\s*$/,
      process: function () {
        return parse_interpol('\r\n<script type="text/javascript">\r\n' +
          '//<![CDATA[\r\n' +
          this.contents.join("\r\n") +
          "\r\n//]]>\r\n</script>\r\n");
      }
    },

    // css blocks
    {
      name: "css",
      regexp: /^(\s*):css\s*$/,
      process: function () {
        return JSON.stringify('<style type="text/css">\r\n' +
          this.contents.join("\r\n") +
          "\r\n</style>");
      }
    }

  ];

  function compile(lines) {
    var block = false,
        output = [];

    // If lines is a string, turn it into an array
    if (typeof lines === 'string') {
      lines = trim( lines ).replace(/\n\r|\r/g, '\n').split('\n');
    }

    foreach(lines, function(line) {
      var match, found = false;

      // Collect all text as raw until outdent
      if (block) {
        match = block.check_indent.exec(line);
        if (match) {
          block.contents.push(match[1] || "");
          return;
        } else {
          output.push(block.process());
          block = false;
        }
      }

      foreach(matchers,function (matcher) {
        if (!found) {
          match = matcher.regexp.exec(line);
          if (match) {
            block = {
              contents: [],
              indent_level: (match[1]),
              matches: match,
              check_indent: new RegExp("^(?:\\s*|" + match[1] + "  (.*))$"),
              process: matcher.process,
              render_contents: function () {
                return compile(this.contents);
              }
            };
            found = true;
          }
        }
      });

      // Match plain text
      if (!found) {
        output.push(function () {
          // Escaped plain text
          if (line[0] === '\\') {
            return parse_interpol(line.substr(1, line.length));
          }

          function escapedLine(){
            try {
              return escaperName+'("'+JSON.stringify(JSON.parse(line)) +'")';
            } catch (e2) {
              return escaperName+'("' + line + '")';
            }
          }
          
          function unescapedLine(){
            try {
              return "("+parse_interpol(JSON.parse(line))+")";
            } catch (e) {
              return "("+line+")";
            }
          }
          
          // always escaped
          if((line.substr(0, 2) === "&=")) {
            line = trim( line.substr(2, line.length) );
            return escapedLine();
          }
          
          //never escaped
          if((line.substr(0, 2) === "!=")) {
            line = trim( line.substr(2, line.length) );
            return unescapedLine();
          }

          if((line.substr(0, 1) === "=")) {
            line = trim( line.substr(1, line.length) );
            if(escapeHtmlByDefault){
              return escapedLine();
            }else{
              return unescapedLine();
            }
          }

          // sometimes escaped
          // if ( (line[0] === '=')) {
          //   line = trim( line.substr(1, line.length) );
          //   if(escapeHtmlByDefault){
          //     return escapedLine();
          //   }else{
          //     return unescapedLine();
          //   }
          // }

          // Plain text
          return parse_interpol(line);
        }());
      }

    });
    if (block) {
      output.push(block.process());
    }
    
    var txt = filter(output, function (part) { return part && part.length > 0}).join(" +\r\n");
    if(txt.length == 0){
      txt = '""';
    }
    return txt;
  };

  function optimize(js) {
    var new_js = [], buffer = [], part, end;

    function flush() {
      if (buffer.length > 0) {
        new_js.push(JSON.stringify(buffer.join("")) + end);
        buffer = [];
      }
    }
    foreach(js.replace(/\n\r|\r/g, '\n').split('\n'), function (line) {
      part = line.match(/^(\".*\")(\s*\+\s*)?$/);
      if (!part) {
        flush();
        new_js.push(line);
        return;
      }
      end = part[2] || "";
      part = part[1];
      try {
        buffer.push(JSON.parse(part));
      } catch (e) {
        flush();
        new_js.push(line);
      }
    });
    flush();
    return new_js.join("\r\n");
  };

  function render(text, options) {
    options = options || {};
    text = text || "";
    var js = compile(text, options);
    if (options.optimize) {
      js = Haml.optimize(js);
    }

    return execute(js, options.context || Haml, options.locals);
  };

  function execute(js, self, locals) {
    return (function () {
      function _$tpl(s,c){
        var ss = (s+"").split(".");
        var ct = c || eval(ss[0]||"");
        for(var i = 1; i < ss.length; i++){
          ct = (ss[i] in ct) ? (ct[ss[i]]||"") : "";
        }
        return ct;
      }

      js = '"";' + _$tpl.toString().replace(/\r|\n/g,"") + "; _$output = _$output + "+ js;

      with(locals || {}) {
        try {
          var _$output;
          //WScript.Echo("_$output =" + js);
          eval("_$output =" + js );
          return _$output; //set in eval
        } catch (e) {
          var emsg = "";
          for (var i in e) {
            if (e[i]) {
              emsg += i + " : " + e[i] + "\r\n";
            }
          }
          return "\r\n<pre class='error'>" + emsg + "</pre>\r\n";//html_escape(e.stack)
        }
      }


    }).call(self);
  };

  function Haml(haml, config) {
    if(typeof(config) != "object"){
      forceXML = config;
      config = {};
    }
    
    var escaper;
    

    if(config.customEscape){
      escaper = "";
      escaperName = config.customEscape;
    }else{
      escaper = html_escape.toString() + "\r\n";
      escaperName = "html_escape";
    }
    
    escapeHtmlByDefault = (config.escapeHtmlByDefault || config.escapeHTML || config.escape_html);
    
    var js = optimize(compile(haml));
    
    var str = "with(locals || {}) {\r\n" +
    "  try {\r\n" +
    "   var _$output=" + js + ";\r\n return _$output;" +
    "  } catch (e) {\r\n" +
    "    return \"\\r\\n<pre class='error'>\" + "+escaperName+"(e.stack) + \"</pre>\\r\\n\";\r\n" +
    "  }\r\n" +
    "}"

    try{
      var f = new Function("locals",  escaper + str );
      return f;
    }catch(e){
      if ( typeof(console) !== 'undefined' ) { console.error(str); }
      throw e;
    }
  }

  Haml.compile = compile;
  Haml.optimize = optimize;
  Haml.render = render;
  Haml.execute = execute;
  Haml.html_escape = html_escape;

  HOST.Haml = Haml;
}(this));


if (typeof exports !== "undefined"){
    exports.Haml = Haml;
};