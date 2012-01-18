(function() {
  var buildMenu, destination, docco_styles, docco_template, ensure_directory, exec, ext, fs, generate_documentation, generate_html, get_language, highlight, highlight_end, highlight_start, l, languages, parse, parse_args, path, relative_base, showdown, spawn, template, _ref;
  generate_documentation = function(source, context, callback) {
    return fs.readFile(source, "utf-8", function(error, code) {
      var sections;
      if (error) {
        throw error;
      }
      sections = parse(source, code);
      try {
        return highlight(source, sections, function() {
          generate_html(source, context, sections);
          return callback();
        });
      } catch (e) {
        return callback();
      }
    });
  };
  parse = function(source, code) {
    var code_text, docs_text, has_code, language, line, lines, save, sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = get_language(source);
    has_code = docs_text = code_text = '';
    save = function(docs, code) {
      return sections.push({
        docs_text: docs,
        code_text: code
      });
    };
    try {
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        line = lines[_i];
        if (line.match(language.comment_matcher) && !line.match(language.comment_filter)) {
          if (has_code) {
            save(docs_text, code_text);
            has_code = docs_text = code_text = '';
          }
          docs_text += line.replace(language.comment_matcher, '') + '\n';
        } else {
          has_code = true;
          code_text += line + '\n';
        }
      }
      save(docs_text, code_text);
    } catch (e) {

    }
    return sections;
  };
  highlight = function(source, sections, callback) {
    var language, output, pygments, section;
    language = get_language(source);
    pygments = spawn('pygmentize', ['-l', language.name, '-f', 'html', '-O', 'encoding=utf-8']);
    output = '';
    pygments.stderr.addListener('data', function(error) {
      if (error) {
        return console.error(error.toString());
      }
    });
    pygments.stdin.addListener('error', function(error) {
      console.error("Could not use Pygments to highlight the source.");
      return process.exit(1);
    });
    pygments.stdout.addListener('data', function(result) {
      if (result) {
        return output += result;
      }
    });
    pygments.addListener('exit', function() {
      var fragments, i, section, _len;
      output = output.replace(highlight_start, '').replace(highlight_end, '');
      fragments = output.split(language.divider_html);
      for (i = 0, _len = sections.length; i < _len; i++) {
        section = sections[i];
        section.code_html = highlight_start + fragments[i] + highlight_end;
        section.docs_html = showdown.makeHtml(section.docs_text);
      }
      return callback();
    });
    if (pygments.stdin.writable) {
      pygments.stdin.write(((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = sections.length; _i < _len; _i++) {
          section = sections[_i];
          _results.push(section.code_text);
        }
        return _results;
      })()).join(language.divider_text));
      return pygments.stdin.end();
    }
  };
  generate_html = function(source, context, sections) {
    var dest, html, menu_html, target_dir, title, write_func;
    title = path.basename(source);
    dest = destination(source, context);
    menu_html = buildMenu(source, context);
    html = docco_template({
      title: title,
      file_path: source,
      sections: sections,
      context: context,
      path: path,
      relative_base: relative_base,
      menu_html: menu_html
    });
    target_dir = path.dirname(dest);
    write_func = function() {
      console.log("docco: " + source + " -> " + dest);
      return fs.writeFile(dest, html, function(err) {
        if (err) {
          throw err;
        }
      });
    };
    return fs.stat(target_dir, function(err, stats) {
      if (err && err.code !== 'ENOENT') {
        throw err;
      }
      if (!err) {
        return write_func();
      }
      if (err) {
        return exec("mkdir -p " + target_dir, function(err) {
          if (err) {
            throw err;
          }
          return write_func();
        });
      }
    });
  };
  fs = require('fs');
  path = require('path');
  showdown = require('./../vendor/showdown').Showdown;
  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;
  languages = {
    '.coffee': {
      name: 'coffee-script',
      symbol: '#'
    },
    '.js': {
      name: 'javascript',
      symbol: '//'
    }
  };
  for (ext in languages) {
    l = languages[ext];
    l.comment_matcher = new RegExp('^\\s*' + l.symbol + '\\s?');
    l.comment_filter = new RegExp('(^#![/]|^\\s*#\\{)');
    l.divider_text = '\n' + l.symbol + 'DIVIDER\n';
    l.divider_html = new RegExp('\\n*<span class="c1?">' + l.symbol + 'DIVIDER<\\/span>\\n*');
  }
  get_language = function(source) {
    return languages[path.extname(source)];
  };
  relative_base = function(filepath, context) {
    var result;
    result = context.relative_root ? path.dirname(filepath).slice(context.relative_root.length) + '/' : '';
    if (result === '/') {
      return '';
    } else {
      return result;
    }
  };
  destination = function(filepath, context) {
    var base_path;
    base_path = relative_base(filepath, context);
    return 'docs/' + base_path + path.basename(filepath, path.extname(filepath)) + '.html';
  };
  ensure_directory = function(dir, callback) {
    return exec("mkdir -p " + dir, function() {
      return callback();
    });
  };
  template = function(str) {
    return new Function('obj', 'var p=[],print=function(){p.push.apply(p,arguments);};' + 'with(obj){p.push(\'' + str.replace(/[\r\t\n]/g, " ").replace(/'(?=[^<]*%>)/g, "\t").split("'").join("\\'").split("\t").join("'").replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');").split('%>').join("p.push('") + "');}return p.join('');");
  };
  docco_template = template(fs.readFileSync(__dirname + '/../resources/docco.jst').toString());
  docco_styles = fs.readFileSync(__dirname + '/../resources/docco.css').toString();
  highlight_start = '<div class="highlight"><pre>';
  highlight_end = '</pre></div>';
  parse_args = function(callback) {
    var args, relative_root;
    args = process.ARGV.sort();
    if (!args.length) {
      return;
    }
    if (!(args.length === 1 && fs.statSync(args[0]).isDirectory())) {
      return callback(args);
    }
    relative_root = args[0].replace(/\/+$/, '');
    return exec("find " + relative_root + " -type f", function(err, stdout) {
      var sources, supported_filetypes;
      if (err) {
        throw err;
      }
      supported_filetypes = ['.coffee'];
      sources = stdout.split("\n").filter(function(file) {
        return file !== '' && path.basename(file)[0] !== '.' && supported_filetypes.indexOf(path.extname(file)) !== -1;
      });
      console.log("docco: Recursively generating docs underneath " + relative_root + "/");
      return callback(sources, relative_root + '/');
    });
  };
  parse_args(function(sources, relative_root) {
    var context;
    context = {
      sources: sources,
      relative_root: relative_root
    };
    return ensure_directory('docs', function() {
      var files, next_file;
      fs.writeFile('docs/docco.css', docco_styles);
      files = sources.slice(0);
      next_file = function() {
        if (files.length) {
          return generate_documentation(files.shift(), context, next_file);
        }
      };
      return next_file();
    });
  });
  buildMenu = function(source, context) {
    var base_path, base_path_array, buildDir, html, paths, root_path, setKey, _i, _len, _ref2;
    root_path = relative_base(source, context).replace(/[^\/]+/g, '..');
    html = "";
    paths = {};
    _ref2 = context.sources;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      source = _ref2[_i];
      base_path = relative_base(source, context);
      base_path_array = base_path.split('/');
      setKey = function(obj, path_array, data) {
        var next_object;
        if (path_array.length === 0 || path_array.length === 1) {
          if (!(obj.root != null)) {
            obj.root = [];
          }
          return obj.root.push(data);
        } else {
          if (!(obj[path_array[0]] != null)) {
            obj[path_array[0]] = {};
          }
          next_object = obj[path_array[0]];
          path_array.shift();
          return setKey(next_object, path_array, data);
        }
      };
      setKey(paths, base_path_array, path.basename(source));
    }
    buildDir = function(obj, level, base_path) {
      var file_path, key, value, _results;
      _results = [];
      for (key in obj) {
        value = obj[key];
        _results.push((function() {
          var _j, _len2, _ref3, _results2;
          if (value instanceof Array) {
            _ref3 = obj[key];
            _results2 = [];
            for (_j = 0, _len2 = _ref3.length; _j < _len2; _j++) {
              file_path = _ref3[_j];
              _results2.push((function(file_path) {
                var file_name;
                file_name = path.basename(file_path, path.extname(file_path));
                return html += "<li><a href=\"" + (root_path + base_path + file_name) + ".html\">" + file_path + "</a></li>";
              })(file_path));
            }
            return _results2;
          } else {
            html += "<div class=\"level" + level + "\"><h3>" + key + "</h3><ul>";
            buildDir(obj[key], level++, base_path + key + '/');
            return html += "</ul></div>";
          }
        })());
      }
      return _results;
    };
    buildDir(paths, 0, '');
    return html;
  };
}).call(this);
