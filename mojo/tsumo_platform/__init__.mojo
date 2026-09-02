from std.python import Python, PythonObject
from ._python_source import PLATFORM_PYTHON_SOURCE


comptime _PYTHON_MODULE_NAME = "_tsumo_platform_v1"


def _module() raises -> PythonObject:
    var sys = Python.import_module("sys")
    if _PYTHON_MODULE_NAME in sys.modules:
        return sys.modules[_PYTHON_MODULE_NAME]
    var module = Python.evaluate(
        PLATFORM_PYTHON_SOURCE,
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


def regular_expression_matches(pattern: String, input: String, limit: Int32) raises -> String:
    return String(py=_module().regular_expression_matches(pattern, input, limit))


def regular_expression_submatches(pattern: String, input: String, limit: Int32) raises -> String:
    return String(py=_module().regular_expression_submatches(pattern, input, limit))


def regular_expression_replace(
    pattern: String, replacement: String, input: String, limit: Int32
) raises -> String:
    return String(py=_module().regular_expression_replace(pattern, replacement, input, limit))


def resize_image(
    input_path: String,
    output_path: String,
    width: Int32,
    height: Int32,
    format_name: String,
) raises:
    _module().resize_image(input_path, output_path, width, height, format_name)
