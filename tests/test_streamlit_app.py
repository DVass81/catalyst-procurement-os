from streamlit.testing.v1 import AppTest


def test_featured_scenario_navigates_without_session_state_error() -> None:
    app = AppTest.from_file("streamlit_app.py", default_timeout=30).run()

    app.button(key="load-featured").click().run()

    assert not app.exception
    assert app.radio(key="navigation_page").value == "Purchase Requests"


def test_global_search_result_navigates_without_session_state_error() -> None:
    app = AppTest.from_file("streamlit_app.py", default_timeout=30).run()
    app.text_input(key="global-search").set_value("00175").run()

    search_results = [
        button for button in app.button if str(button.key).startswith("search-result")
    ]
    assert search_results

    search_results[0].click().run()

    assert not app.exception
    assert app.radio(key="navigation_page").value == "Purchase Requests"
