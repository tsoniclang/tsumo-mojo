from std.testing import assert_equal, assert_true
from tsumo_platform import (
    MarkdownBatch,
    MarkdownDocument,
    create_markdown_source_plan,
    decode_html,
)


def main() raises:
    var plan = create_markdown_source_plan("# Intro\n\nSummary.\n\n<!--more-->\n\nDetail.")
    assert_true(plan.full_source.find("<!--more-->") < 0)
    assert_equal(plan.summary_source, "# Intro\n\nSummary.\n\n")
    assert_true(plan.toc_source.find("Detail.") >= 0)

    var document = MarkdownDocument("# Intro\n\n[site](https://old.test)\n\n~~old~~ new")
    assert_equal(document.occurrence_count(), 2)
    var heading = document.occurrence(0)
    assert_equal(heading.kind, "heading")
    assert_equal(heading.anchor, "intro")
    var link = document.occurrence(1)
    assert_equal(link.kind, "link")
    assert_equal(link.destination, "https://old.test")
    document.replace_url(1, "https://new.test")
    assert_true(document.render().find("https://new.test") >= 0)
    assert_true(document.render().find("<del>old</del>") >= 0)
    assert_true(document.table_of_contents().find("#intro") >= 0)
    var linked = MarkdownDocument("Visit https://tsonic.org.")
    assert_true(linked.render().find('<a href="https://tsonic.org">https://tsonic.org</a>.') >= 0)

    var unsafe_document = MarkdownDocument("# Safe heading\n\n[Unsafe](javascript:alert(1))")
    assert_equal(unsafe_document.occurrence_count(), 2)
    assert_equal(unsafe_document.occurrence(1).destination, "javascript:alert(1)")
    assert_true(unsafe_document.occurrence_html(0).find("Safe heading") >= 0)
    var rejected = False
    try:
        _ = unsafe_document.render()
    except:
        rejected = True
    assert_true(rejected)
    unsafe_document.replace_url(1, "https://safe.test")
    assert_true(unsafe_document.render().find('href="https://safe.test"') >= 0)

    var batch = MarkdownBatch()
    var index = batch.add_source("# Batch\n\nBody.")
    batch.render()
    var result = batch.take_result(index)
    assert_true(result.html.find("<h1") >= 0)
    assert_true(result.plain_text.find("Body.") >= 0)
    assert_true(result.table_of_contents.find("#batch") >= 0)
    assert_equal(decode_html("&lt;safe&gt;"), "<safe>")
