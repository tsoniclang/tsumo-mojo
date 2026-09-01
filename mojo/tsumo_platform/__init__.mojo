from std.python import Python, PythonObject


comptime _PYTHON_SOURCE = """
import copy
import html
import quickjs
from markdown_it import MarkdownIt
from markdown_it.token import Token
from mdit_py_plugins.footnote import footnote_plugin
from mdit_py_plugins.tasklists import tasklists_plugin
from PIL import Image


_REGULAR_EXPRESSION = quickjs.Function("regularExpression", r'''
function digitValue(value) {
    if (value.length !== 1) return -1;
    const code = value.charCodeAt(0);
    return code >= 48 && code <= 57 ? code - 48 : -1;
}

function expandReplacement(replacement, input, match) {
    const result = [];
    const fullMatch = match[0];
    const matchIndex = match.index;
    for (let index = 0; index < replacement.length; index++) {
        const current = replacement.charAt(index);
        if (current !== "$" || index + 1 >= replacement.length) {
            result.push(current);
            continue;
        }
        const next = replacement.charAt(index + 1);
        if (next === "$") {
            result.push("$");
            index++;
            continue;
        }
        if (next === "&") {
            result.push(fullMatch);
            index++;
            continue;
        }
        if (next === "`") {
            result.push(input.slice(0, matchIndex));
            index++;
            continue;
        }
        if (next === "'") {
            result.push(input.slice(matchIndex + fullMatch.length));
            index++;
            continue;
        }
        if (next === "<" && match.groups !== undefined) {
            const closing = replacement.indexOf(">", index + 2);
            if (closing >= 0) {
                const groupName = replacement.slice(index + 2, closing);
                result.push(match.groups[groupName] ?? "");
                index = closing;
                continue;
            }
        }
        const firstDigit = digitValue(next);
        if (firstDigit >= 0) {
            let captureIndex = -1;
            let consumedDigits = 0;
            if (index + 2 < replacement.length) {
                const secondDigit = digitValue(replacement.charAt(index + 2));
                const twoDigitIndex = firstDigit * 10 + secondDigit;
                if (secondDigit >= 0 && twoDigitIndex > 0 && twoDigitIndex < match.length) {
                    captureIndex = twoDigitIndex;
                    consumedDigits = 2;
                }
            }
            if (captureIndex < 0 && firstDigit > 0 && firstDigit < match.length) {
                captureIndex = firstDigit;
                consumedDigits = 1;
            }
            if (captureIndex > 0) {
                result.push(match[captureIndex] ?? "");
                index += consumedDigits;
                continue;
            }
        }
        result.push("$");
    }
    return result.join("");
}

function regularExpression(operation, pattern, flags, input, replacement, limit) {
    const expression = new RegExp(pattern, flags);
    if (operation === "test") return expression.test(input);
    if (operation === "matches") {
        const result = [];
        for (const match of input.matchAll(expression)) {
            result.push(match[0]);
            if (limit > 0 && result.length >= limit) break;
        }
        return JSON.stringify(result);
    }
    if (operation === "submatches") {
        const result = [];
        for (const match of input.matchAll(expression)) {
            result.push(Array.from(match, value => value ?? ""));
            if (limit > 0 && result.length >= limit) break;
        }
        return JSON.stringify(result);
    }
    if (operation === "replace") {
        if (limit < 0) return input.replace(expression, replacement);
        const result = [];
        let cursor = 0;
        let remaining = limit;
        for (const match of input.matchAll(expression)) {
            if (remaining === 0) break;
            result.push(input.slice(cursor, match.index));
            result.push(expandReplacement(replacement, input, match));
            cursor = match.index + match[0].length;
            remaining--;
        }
        result.push(input.slice(cursor));
        return result.join("");
    }
    throw new Error("unknown regular-expression operation");
}
''')


def regular_expression_is_valid(pattern, flags):
    try:
        _REGULAR_EXPRESSION("test", pattern, flags, "", "", 0)
        return True
    except quickjs.JSException:
        return False


def regular_expression_test(pattern, flags, input):
    return _REGULAR_EXPRESSION("test", pattern, flags, input, "", 0)


def regular_expression_matches(pattern, input, limit):
    return _REGULAR_EXPRESSION("matches", pattern, "g", input, "", limit)


def regular_expression_submatches(pattern, input, limit):
    return _REGULAR_EXPRESSION("submatches", pattern, "g", input, "", limit)


def regular_expression_replace(pattern, replacement, input, limit):
    return _REGULAR_EXPRESSION("replace", pattern, "g", input, replacement, limit)


def _markdown():
    parser = MarkdownIt("commonmark", {"html": True, "linkify": True})
    parser.enable(["table", "strikethrough"])
    parser.use(footnote_plugin)
    parser.use(tasklists_plugin)
    return parser


def _plain_inline(children):
    result = []
    for child in children or []:
        if child.type in ("text", "code_inline"):
            result.append(child.content)
        elif child.type in ("softbreak", "hardbreak"):
            result.append("\\n")
        elif child.type == "image":
            result.append(child.content)
    return "".join(result)


def _anchor(value):
    output = []
    pending_dash = False
    for character in value.lower():
        if character.isalnum() or character in "_-":
            if pending_dash and output and output[-1] != "-":
                output.append("-")
            pending_dash = False
            output.append(character)
        else:
            pending_dash = True
    return "".join(output).strip("-") or "heading"


def _attr(token, name):
    return token.attrGet(name) or ""


def _set_attr(token, name, value):
    token.attrSet(name, value)


class Document:
    def __init__(self, source):
        self.parser = _markdown()
        self.tokens = self.parser.parse(source)
        self.occurrences = []
        self.replacements = {}
        self.urls = {}
        anchors = {}
        for token_index, token in enumerate(self.tokens):
            if token.type == "heading_open":
                inline = self.tokens[token_index + 1]
                text = _plain_inline(inline.children)
                base = _anchor(text)
                count = anchors.get(base, 0)
                anchors[base] = count + 1
                anchor = base if count == 0 else f"{base}-{count}"
                _set_attr(token, "id", anchor)
                self.occurrences.append({
                    "kind": "heading",
                    "destination": "",
                    "title": "",
                    "plain_text": text.strip(),
                    "level": int(token.tag[1:]),
                    "anchor": anchor,
                    "token": token_index,
                    "child_start": -1,
                    "child_end": -1,
                })
            if token.type != "inline":
                continue
            children = token.children or []
            stack = []
            for child_index, child in enumerate(children):
                if child.type == "link_open":
                    stack.append(child_index)
                elif child.type == "link_close" and stack:
                    start = stack.pop()
                    opening = children[start]
                    text = _plain_inline(children[start + 1:child_index])
                    self.occurrences.append({
                        "kind": "link",
                        "destination": _attr(opening, "href"),
                        "title": _attr(opening, "title"),
                        "plain_text": text.strip(),
                        "level": 0,
                        "anchor": "",
                        "token": token_index,
                        "child_start": start,
                        "child_end": child_index,
                    })
                elif child.type == "image":
                    self.occurrences.append({
                        "kind": "image",
                        "destination": _attr(child, "src"),
                        "title": _attr(child, "title"),
                        "plain_text": child.content.strip(),
                        "level": 0,
                        "anchor": "",
                        "token": token_index,
                        "child_start": child_index,
                        "child_end": child_index,
                    })

    def occurrence_count(self):
        return len(self.occurrences)

    def occurrence(self, index):
        return self.occurrences[index]

    def replace_html(self, index, value):
        self.replacements[index] = value

    def replace_url(self, index, value):
        if self.occurrences[index]["kind"] not in ("link", "image"):
            raise ValueError("only link and image occurrences have replaceable URLs")
        self.urls[index] = value

    def _modified_tokens(self, only_occurrence=None):
        tokens = copy.deepcopy(self.tokens)
        by_token = {}
        for index, occurrence in enumerate(self.occurrences):
            by_token.setdefault(occurrence["token"], []).append((index, occurrence))
        for token_index, occurrences in sorted(by_token.items(), reverse=True):
            token = tokens[token_index]
            heading = next((item for item in occurrences if item[1]["kind"] == "heading"), None)
            if heading is not None:
                index, occurrence = heading
                _set_attr(token, "id", occurrence["anchor"])
                if index in self.replacements:
                    html_token = Token("html_block", "", 0)
                    html_token.content = self.replacements[index]
                    tokens[token_index:token_index + 3] = [html_token]
                    continue
            if token.type != "inline":
                continue
            children = token.children or []
            for index, occurrence in sorted(
                [item for item in occurrences if item[1]["kind"] != "heading"],
                key=lambda item: item[1]["child_start"],
                reverse=True,
            ):
                start = occurrence["child_start"]
                end = occurrence["child_end"]
                if index in self.urls:
                    if occurrence["kind"] == "link":
                        _set_attr(children[start], "href", self.urls[index])
                    else:
                        _set_attr(children[start], "src", self.urls[index])
                if index in self.replacements:
                    replacement = Token("html_inline", "", 0)
                    replacement.content = self.replacements[index]
                    children[start:end + 1] = [replacement]
            token.children = children
        if only_occurrence is None:
            return tokens
        occurrence = self.occurrences[only_occurrence]
        if occurrence["kind"] == "heading":
            token_index = occurrence["token"]
            return tokens[token_index:token_index + 3]
        inline = tokens[occurrence["token"]]
        holder = Token("inline", "", 0)
        holder.children = inline.children[
            occurrence["child_start"]:occurrence["child_end"] + 1
        ]
        return [holder]

    def render(self):
        return self.parser.renderer.render(self._modified_tokens(), self.parser.options, {})

    def occurrence_html(self, index):
        return self.parser.renderer.render(
            self._modified_tokens(index), self.parser.options, {}
        )

    def plain_text(self):
        output = []
        for token in self.tokens:
            if token.type == "inline":
                text = _plain_inline(token.children)
                if text:
                    output.append(text)
            elif token.type == "code_block" or token.type == "fence":
                output.append(token.content)
        return "\\n".join(output).strip()

    def table_of_contents(self):
        headings = [
            occurrence for occurrence in self.occurrences
            if occurrence["kind"] == "heading"
        ]
        if not headings:
            return '<nav id="TableOfContents"></nav>'
        output = ['<nav id="TableOfContents">', '<ul>']
        current = 1
        for heading in headings:
            level = max(1, heading["level"])
            while current < level:
                output.append("<ul>")
                current += 1
            while current > level:
                output.append("</ul>")
                current -= 1
            output.append(
                '<li><a href="#{}">{}</a></li>'.format(
                    html.escape(heading["anchor"], quote=True),
                    html.escape(heading["plain_text"], quote=True),
                )
            )
        while current > 1:
            output.append("</ul>")
            current -= 1
        output.extend(["</ul>", "</nav>"])
        return "\\n".join(output)


def source_plan(source):
    markdown = source.replace("\\r\\n", "\\n").replace("\\r", "\\n")
    lowered = markdown.lower()
    marker = "<!--more-->"
    index = lowered.find(marker)
    if index >= 0:
        return (markdown[:index] + markdown[index + len(marker):], markdown[:index], markdown)
    trimmed = markdown.strip()
    separator = trimmed.find("\\n\\n")
    summary = trimmed[:separator] if separator >= 0 else trimmed
    return (markdown, summary, markdown)


def render_batch(requests):
    results = []
    for source in requests:
        full_source, summary_source, toc_source = source_plan(source)
        document = Document(full_source)
        html_output = document.render()
        summary = (
            html_output.strip()
            if summary_source == full_source
            else Document(summary_source).render().strip()
        )
        toc = (
            document.table_of_contents()
            if toc_source == full_source
            else Document(toc_source).table_of_contents()
        )
        results.append({
            "html": html_output,
            "summary_html": summary,
            "plain_text": document.plain_text(),
            "table_of_contents": toc,
        })
    return results


def resize_image(input_path, output_path, width, height, format_name):
    with Image.open(input_path) as image:
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        target_format = {"jpg": "JPEG"}.get(format_name.lower(), format_name.upper())
        resized.save(output_path, format=target_format)
"""


comptime _PYTHON_MODULE_NAME = "_tsumo_platform_v1"


def _module() raises -> PythonObject:
    var sys = Python.import_module("sys")
    if _PYTHON_MODULE_NAME in sys.modules:
        return sys.modules[_PYTHON_MODULE_NAME]
    var module = Python.evaluate(
        _PYTHON_SOURCE,
        file=True,
        name=_PYTHON_MODULE_NAME,
    )
    sys.modules[_PYTHON_MODULE_NAME] = module
    return module


struct MarkdownOccurrence:
    var kind: String
    var destination: String
    var title: String
    var plain_text: String
    var level: Int32
    var anchor: String

    def __init__(
        out self,
        var kind: String,
        var destination: String,
        var title: String,
        var plain_text: String,
        level: Int32,
        var anchor: String,
    ):
        self.kind = kind^
        self.destination = destination^
        self.title = title^
        self.plain_text = plain_text^
        self.level = level
        self.anchor = anchor^


struct MarkdownSourcePlan:
    var full_source: String
    var summary_source: String
    var toc_source: String

    def __init__(
        out self,
        var full_source: String,
        var summary_source: String,
        var toc_source: String,
    ):
        self.full_source = full_source^
        self.summary_source = summary_source^
        self.toc_source = toc_source^


struct MarkdownBatchResult:
    var html: String
    var summary_html: String
    var plain_text: String
    var table_of_contents: String

    def __init__(
        out self,
        var html: String,
        var summary_html: String,
        var plain_text: String,
        var table_of_contents: String,
    ):
        self.html = html^
        self.summary_html = summary_html^
        self.plain_text = plain_text^
        self.table_of_contents = table_of_contents^


def _occurrence(value: PythonObject) raises -> MarkdownOccurrence:
    return MarkdownOccurrence(
        String(py=value["kind"]),
        String(py=value["destination"]),
        String(py=value["title"]),
        String(py=value["plain_text"]),
        Int32(Int(py=value["level"])),
        String(py=value["anchor"]),
    )


def _batch_result(value: PythonObject) raises -> MarkdownBatchResult:
    return MarkdownBatchResult(
        String(py=value["html"]),
        String(py=value["summary_html"]),
        String(py=value["plain_text"]),
        String(py=value["table_of_contents"]),
    )


struct MarkdownBatch:
    var _requests: PythonObject
    var _results: PythonObject
    var _rendered: Bool

    def __init__(out self) raises:
        self._requests = Python.evaluate("[]")
        self._results = Python.evaluate("[]")
        self._rendered = False

    def add_source(mut self, source: String) raises -> Int32:
        if self._rendered:
            raise Error("markdown requests cannot be added after rendering begins")
        var index = Int32(Int(py=self._requests.__len__()))
        self._requests.append(source)
        return index

    def render(mut self) raises:
        if self._rendered:
            raise Error("markdown batch has already been rendered")
        self._rendered = True
        self._results = _module().render_batch(self._requests)

    def take_result(mut self, index: Int32) raises -> MarkdownBatchResult:
        if not self._rendered:
            raise Error("markdown batch results are not available")
        var value = self._results[index]
        if value is PythonObject(None):
            raise Error("markdown batch result has already been consumed")
        self._results[index] = PythonObject(None)
        return _batch_result(value)


struct MarkdownDocument:
    var _document: PythonObject

    def __init__(out self, source: String) raises:
        self._document = _module().Document(source)

    def occurrence_count(self) raises -> Int32:
        return Int32(Int(py=self._document.occurrence_count()))

    def occurrence(self, index: Int32) raises -> MarkdownOccurrence:
        return _occurrence(self._document.occurrence(index))

    def replace_html(mut self, index: Int32, value: String) raises:
        self._document.replace_html(index, value)

    def replace_url(mut self, index: Int32, value: String) raises:
        self._document.replace_url(index, value)

    def occurrence_html(self, index: Int32) raises -> String:
        return String(py=self._document.occurrence_html(index))

    def render(self) raises -> String:
        return String(py=self._document.render())

    def plain_text(self) raises -> String:
        return String(py=self._document.plain_text())

    def table_of_contents(self) raises -> String:
        return String(py=self._document.table_of_contents())


def create_markdown_source_plan(source: String) raises -> MarkdownSourcePlan:
    var plan = _module().source_plan(source)
    return MarkdownSourcePlan(
        String(py=plan[0]),
        String(py=plan[1]),
        String(py=plan[2]),
    )


def decode_html(source: String) raises -> String:
    return String(py=Python.import_module("html").unescape(source))


def regular_expression_is_valid(pattern: String, flags: String) raises -> Bool:
    return Python.is_true(_module().regular_expression_is_valid(pattern, flags))


def regular_expression_test(pattern: String, flags: String, input: String) raises -> Bool:
    return Python.is_true(_module().regular_expression_test(pattern, flags, input))


def regular_expression_matches(
    pattern: String, input: String, limit: Int32
) raises -> String:
    return String(py=_module().regular_expression_matches(pattern, input, limit))


def regular_expression_submatches(
    pattern: String, input: String, limit: Int32
) raises -> String:
    return String(py=_module().regular_expression_submatches(pattern, input, limit))


def regular_expression_replace(
    pattern: String, replacement: String, input: String, limit: Int32
) raises -> String:
    return String(
        py=_module().regular_expression_replace(pattern, replacement, input, limit)
    )


def resize_image(
    input_path: String,
    output_path: String,
    width: Int32,
    height: Int32,
    format_name: String,
) raises:
    _module().resize_image(input_path, output_path, width, height, format_name)
