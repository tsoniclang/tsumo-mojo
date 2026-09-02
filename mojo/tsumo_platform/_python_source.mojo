comptime PLATFORM_PYTHON_SOURCE = """
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
