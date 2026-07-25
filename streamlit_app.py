from __future__ import annotations

import base64
from datetime import date
from pathlib import Path
from textwrap import dedent
from typing import Callable

import pandas as pd
import streamlit as st


st.set_page_config(
    page_title="Catalyst Procurement OS · Y-12 Demo",
    page_icon="⚛",
    layout="wide",
    initial_sidebar_state="expanded",
)


BRAND = {
    "navy": "#041A6C",
    "navy_light": "#142573",
    "coral": "#CF4427",
    "gold": "#EBBF5D",
    "peach": "#F0CB7C",
    "violet": "#404287",
    "green": "#16856B",
    "ink": "#101B3B",
    "muted": "#65708A",
    "surface": "#FFFFFF",
    "background": "#F7F6F1",
    "line": "#E7E4DC",
}

ASSET_DIR = Path(__file__).resolve().parent / "assets"


def asset_data_uri(filename: str) -> str:
    path = ASSET_DIR / filename
    if not path.exists():
        return ""
    suffix = path.suffix.lower().lstrip(".")
    mime = "image/jpeg" if suffix in {"jpg", "jpeg"} else f"image/{suffix}"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"

STAGES = ["Request", "Approval", "Purchase order", "Receiving", "Invoice match"]
STAGE_INDEX = {
    "draft": 0,
    "submitted": 1,
    "approved": 1,
    "po": 2,
    "received": 3,
    "exception": 4,
}


def init_state() -> None:
    defaults = {
        "page": "Dashboard",
        "stage": "draft",
        "role": "Purchasing Manager",
        "inventory": True,
        "headset": True,
        "ai_sent": False,
        "toast": "",
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def reset_demo() -> None:
    for key in list(st.session_state):
        del st.session_state[key]
    init_state()
    st.session_state.toast = "Demo restored to its starting state."


def navigate(page: str) -> None:
    st.session_state.page = page


def advance(stage: str, message: str) -> None:
    st.session_state.stage = stage
    st.session_state.toast = message


def money(value: int) -> str:
    return f"${value:,.0f}"


def request_total() -> int:
    return 9_876 - (1_047 if st.session_state.inventory else 0) - (
        84 if st.session_state.headset else 0
    )


def badge(text: str, tone: str = "blue") -> str:
    return f'<span class="badge {tone}">{text}</span>'


def panel(title: str, eyebrow: str, body: str, action: str = "") -> None:
    action_html = f'<span class="panel-action">{action}</span>' if action else ""
    st.markdown(
        f"""
        <div class="panel">
          <div class="panel-header">
            <div><span class="eyebrow">{eyebrow}</span><h3>{title}</h3></div>
            {action_html}
          </div>
          {body}
        </div>
        """,
        unsafe_allow_html=True,
    )


def inject_css() -> None:
    st.markdown(
        f"""
        <style>
          :root {{
            --navy:{BRAND["navy"]}; --navy2:{BRAND["navy_light"]};
            --coral:{BRAND["coral"]}; --gold:{BRAND["gold"]};
            --green:{BRAND["green"]}; --ink:{BRAND["ink"]};
            --muted:{BRAND["muted"]}; --line:{BRAND["line"]};
            --bg:{BRAND["background"]};
          }}
          html, body, [class*="css"] {{ font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }}
          .stApp {{ background:var(--bg); color:var(--ink); }}
          header[data-testid="stHeader"] {{ background:rgba(255,255,255,.94); border-bottom:1px solid var(--line); }}
          .block-container {{ max-width:1480px; padding:1.5rem 2.1rem 4rem; }}
          [data-testid="stSidebar"] {{ background:var(--navy); border-right:0; }}
          [data-testid="stSidebar"] > div:first-child {{ padding:1.2rem .9rem; }}
          [data-testid="stSidebar"] * {{ color:#E7ECF5; }}
          [data-testid="stSidebar"] .stRadio label {{
            padding:.45rem .55rem; border-radius:8px; margin:.04rem 0; transition:.15s;
          }}
          [data-testid="stSidebar"] .stRadio label:hover {{ background:rgba(255,255,255,.08); }}
          [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] > div {{
            background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.12);
          }}
          [data-testid="stSidebar"] hr {{ border-color:rgba(255,255,255,.12); }}
          [data-testid="stMetric"] {{
            background:#fff; border:1px solid var(--line); border-radius:12px;
            padding:1rem 1.05rem; box-shadow:0 1px 2px rgba(23,42,85,.03);
          }}
          [data-testid="stMetricLabel"] {{ font-size:.72rem; color:var(--muted); font-weight:700; }}
          [data-testid="stMetricValue"] {{ font-size:1.65rem; color:var(--ink); font-weight:760; }}
          [data-testid="stMetricDelta"] {{ font-size:.68rem; }}
          .brand-wrap {{ display:flex; align-items:center; gap:.8rem; padding:.2rem .4rem .9rem; }}
          .brand-wrap img {{ width:66px; max-height:48px; object-fit:contain; }}
          .brand-copy b {{ letter-spacing:.16em; font-size:.74rem; color:white; }}
          .brand-copy small {{ display:block; color:#AEBAD0; font-size:.63rem; margin-top:.15rem; }}
          .demo-pill {{
            border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06);
            color:#CDD6E7; border-radius:8px; padding:.52rem .65rem; font-size:.58rem;
            letter-spacing:.11em; margin:0 .15rem 1rem;
          }}
          .demo-pill i {{ display:inline-block; width:6px; height:6px; border-radius:50%;
            background:var(--gold); margin-right:.4rem; }}
          .powered {{ border-top:1px solid rgba(255,255,255,.12); margin-top:1.4rem; padding:1rem .4rem 0; }}
          .powered span {{ font-size:.51rem; color:#8492AD; letter-spacing:.15em; }}
          .powered b {{ display:block; font-size:.66rem; color:#D8DFEC; margin-top:.2rem; }}
          .notice {{
            background:#FFFAF0; border:1px solid #EEE5CC; color:#796B4B; border-radius:8px;
            padding:.5rem .7rem; text-align:center; font-size:.63rem; margin-bottom:1.2rem;
          }}
          .page-head {{ display:flex; justify-content:space-between; align-items:end; margin-bottom:1.25rem; }}
          .page-head .kicker, .eyebrow {{ color:var(--coral); font-size:.57rem; letter-spacing:.14em; font-weight:800; }}
          .page-head h1 {{ font-size:1.75rem; margin:.25rem 0 .2rem; letter-spacing:-.035em; color:var(--ink); }}
          .page-head p {{ color:var(--muted); font-size:.77rem; margin:0; }}
          .panel {{
            background:#fff; border:1px solid var(--line); border-radius:12px;
            padding:1.05rem; box-shadow:0 1px 2px rgba(23,42,85,.03); margin-bottom:.85rem;
          }}
          .panel-header {{ display:flex; justify-content:space-between; align-items:start; margin-bottom:.75rem; }}
          .panel-header h3 {{ font-size:.95rem; margin:.22rem 0 0; color:var(--ink); }}
          .panel-action {{ color:#365B88; font-size:.61rem; font-weight:700; }}
          .spend-value {{ font-size:1.45rem; font-weight:780; margin:.2rem 0; }}
          .subtle {{ color:var(--muted); font-size:.64rem; }}
          .positive {{ color:var(--green); }}
          .queue-row, .vendor-row, .list-row {{
            display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:.7rem;
            padding:.7rem 0; border-top:1px solid #EDF0F4;
          }}
          .row-icon {{
            width:32px; height:32px; display:grid; place-items:center; border-radius:8px;
            background:#EEF2F7; color:var(--navy); font-weight:800; font-size:.68rem;
          }}
          .row-icon.coral {{ background:#FDE9E7; color:#D95652; }}
          .row-icon.gold {{ background:#FFF1DD; color:#B97816; }}
          .row-title {{ font-size:.7rem; font-weight:760; color:var(--ink); }}
          .row-meta {{ display:block; color:#87909F; font-size:.57rem; margin-top:.15rem; }}
          .row-value {{ font-size:.7rem; font-weight:760; text-align:right; }}
          .row-value small {{ display:block; color:#87909F; font-size:.55rem; font-weight:500; }}
          .insight {{
            display:flex; gap:.7rem; background:#F1F5FB; border:1px solid #DBE5F3;
            border-radius:9px; padding:.85rem; margin:.55rem 0;
          }}
          .insight-icon {{
            flex:0 0 30px; width:30px; height:30px; display:grid; place-items:center;
            border-radius:9px; background:linear-gradient(135deg,var(--coral),#F17A42);
            color:white; font-weight:800;
          }}
          .insight b {{ font-size:.69rem; }} .insight p {{ color:var(--muted); font-size:.62rem; line-height:1.45; margin:.22rem 0 0; }}
          .budget-line {{ margin:.72rem 0; }}
          .budget-label {{ display:flex; justify-content:space-between; font-size:.63rem; margin-bottom:.28rem; }}
          .budget-label b {{ font-size:.57rem; color:var(--muted); }}
          .track {{ height:6px; background:#ECF0F5; border-radius:9px; overflow:hidden; }}
          .track i {{ display:block; height:100%; background:var(--navy); border-radius:9px; }}
          .story {{
            display:flex; align-items:center; justify-content:space-between; gap:1rem;
            background:var(--navy); color:white; border-radius:11px; padding:.9rem 1rem; margin-top:.25rem;
          }}
          .story span {{ color:var(--gold); font-size:.54rem; letter-spacing:.12em; }}
          .story b {{ display:block; font-size:.78rem; margin:.15rem 0; }}
          .story small {{ color:#AFBBD0; font-size:.57rem; }}
          .story strong {{ font-size:1.2rem; }}
          .timeline {{ display:flex; align-items:center; background:white; border:1px solid var(--line); border-radius:10px; padding:.7rem .9rem; margin-bottom:.9rem; }}
          .step {{ flex:1; display:flex; align-items:center; gap:.45rem; color:#9AA3B1; font-size:.59rem; position:relative; }}
          .step:after {{ content:""; height:1px; background:#DDE2EA; position:absolute; left:72px; right:8px; }}
          .step:last-child:after {{ display:none; }}
          .step i {{ width:23px; height:23px; display:grid; place-items:center; background:white; border:1px solid #D9DEE7; border-radius:50%; font-style:normal; z-index:1; }}
          .step.done, .step.active {{ color:var(--navy); font-weight:760; }}
          .step.done i {{ background:var(--green); color:white; border-color:var(--green); }}
          .step.active i {{ background:var(--navy); color:white; border-color:var(--navy); }}
          .request-title {{ display:flex; justify-content:space-between; gap:1rem; border-bottom:1px solid #EDF0F4; padding-bottom:1rem; }}
          .request-title h2 {{ font-size:1.15rem; margin:.25rem 0; }}
          .request-title p {{ color:var(--muted); font-size:.66rem; max-width:720px; line-height:1.5; }}
          .request-total {{ text-align:right; min-width:145px; }}
          .request-total small {{ font-size:.52rem; color:#8B95A4; letter-spacing:.08em; }}
          .request-total b {{ display:block; font-size:1.55rem; margin:.25rem 0; }}
          .request-meta {{ display:grid; grid-template-columns:repeat(4,1fr); background:#F7F8FA; border-radius:9px; padding:.75rem; margin:1rem 0; }}
          .request-meta div {{ padding:0 .65rem; border-right:1px solid var(--line); }}
          .request-meta div:last-child {{ border:0; }}
          .request-meta small {{ display:block; font-size:.5rem; color:#939BA7; letter-spacing:.09em; }}
          .request-meta b {{ font-size:.61rem; }}
          .section-label {{ font-size:.55rem; color:#8B94A3; letter-spacing:.12em; font-weight:800; margin:1rem 0 .45rem; }}
          .recommendation {{
            display:grid; grid-template-columns:35px 1fr auto; gap:.65rem; align-items:center;
            border:1px solid var(--line); border-left:3px solid var(--green);
            border-radius:9px; padding:.72rem; margin:.45rem 0;
          }}
          .recommendation.gold {{ border-left-color:#D48A20; }}
          .recommendation h4 {{ font-size:.67rem; margin:0; }}
          .recommendation p {{ color:var(--muted); font-size:.57rem; margin:.16rem 0 0; }}
          .recommendation .saving {{ color:var(--green); font-size:.59rem; font-weight:760; text-align:right; }}
          .vendor-card {{ display:grid; grid-template-columns:38px 1fr auto auto; gap:.7rem; align-items:center; background:#F4F7FB; border:1px solid #D9E3F1; border-radius:9px; padding:.75rem; }}
          .vendor-card h4 {{ font-size:.68rem; margin:0; }} .vendor-card p {{ color:var(--muted); font-size:.57rem; margin:.15rem 0 0; }}
          .vendor-score {{ text-align:center; padding:0 1rem; border-right:1px solid #DCE3ED; }}
          .vendor-score small {{ display:block; font-size:.48rem; color:#8A94A4; }} .vendor-score b {{ color:var(--green); font-size:1.15rem; }}
          .vendor-price {{ text-align:right; }} .vendor-price b {{ display:block; font-size:.88rem; }} .vendor-price small {{ color:var(--green); font-size:.52rem; }}
          .budget-ok {{ display:flex; gap:.65rem; align-items:center; background:#F3FAF8; border:1px solid #D5E8E1; border-radius:9px; padding:.7rem; margin-top:.5rem; }}
          .budget-ok i {{ width:24px; height:24px; display:grid; place-items:center; border-radius:50%; background:var(--green); color:white; font-style:normal; }}
          .budget-ok b {{ font-size:.66rem; }} .budget-ok small {{ display:block; color:#718178; font-size:.54rem; }}
          .badge {{ display:inline-block; border-radius:999px; padding:.2rem .45rem; font-size:.5rem; font-weight:800; letter-spacing:.05em; }}
          .badge.blue {{ color:#365B88; background:#E8EFF8; }} .badge.green {{ color:var(--green); background:#E3F3EE; }}
          .badge.red {{ color:#C74A46; background:#FDE9E7; }} .badge.gold {{ color:#A76A12; background:#FFF1DD; }}
          .ai-hero {{ text-align:center; max-width:820px; margin:2.5rem auto 1.25rem; }}
          .ai-orb {{ width:48px; height:48px; display:grid; place-items:center; margin:auto; border-radius:14px; background:linear-gradient(135deg,var(--coral),#F17A42); color:white; font-size:1.25rem; }}
          .ai-hero h1 {{ font-size:2rem; letter-spacing:-.04em; margin:.8rem 0 .35rem; }}
          .ai-hero p {{ color:var(--muted); font-size:.76rem; }}
          .ai-result {{ display:flex; gap:.8rem; background:#F1F5FB; border:1px solid #DCE5F1; border-radius:11px; padding:1rem; margin:1rem 0; }}
          .ai-result b {{ font-size:.77rem; }} .ai-result p {{ color:var(--muted); font-size:.65rem; line-height:1.45; }}
          .exception {{ display:flex; gap:.7rem; align-items:center; background:#FFF8ED; border:1px solid #F3E0C4; border-radius:9px; padding:.85rem; }}
          .exception i {{ width:28px; height:28px; display:grid; place-items:center; border-radius:50%; background:#D48A20; color:white; font-style:normal; font-weight:800; }}
          .exception b {{ font-size:.7rem; }} .exception small {{ display:block; color:#837766; font-size:.57rem; margin-top:.15rem; }}
          div.stButton > button {{ border-radius:8px; font-weight:760; font-size:.7rem; border-color:#DDE2EA; }}
          div.stButton > button[kind="primary"] {{ background:var(--coral); border-color:var(--coral); }}
          div.stButton > button[kind="primary"]:hover {{ background:#D9483E; border-color:#D9483E; }}
          [data-testid="stTabs"] button {{ font-size:.7rem; }}
          @media (max-width:900px) {{
            .block-container {{ padding:1.1rem; }}
            .request-meta {{ grid-template-columns:1fr 1fr; gap:.75rem; }}
            .request-meta div {{ border:0; }}
            .timeline .step span {{ display:none; }}
            .step:after {{ left:26px; }}
            .story small {{ display:none; }}
          }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def inject_premium_css() -> None:
    st.markdown(
        f"""
        <style>
          :root {{
            --y12-blue:#041A6C;
            --y12-blue-2:#142573;
            --y12-red:#CF4427;
            --y12-gold:#EBBF5D;
            --y12-peach:#F0CB7C;
            --y12-violet:#404287;
            --ink:#101B3B;
            --muted:#65708A;
            --canvas:#F7F6F1;
            --card:#FFFFFF;
            --line:#E7E4DC;
          }}

          html, body, [class*="css"] {{
            font-family:"Avenir Next","Segoe UI",Inter,ui-sans-serif,system-ui,sans-serif;
          }}
          .stApp {{
            background:
              radial-gradient(circle at 86% -8%, rgba(235,191,93,.23), transparent 28rem),
              radial-gradient(circle at 22% 24%, rgba(207,68,39,.05), transparent 28rem),
              var(--canvas);
            color:var(--ink);
          }}
          header[data-testid="stHeader"] {{
            height:3.25rem;
            background:rgba(247,246,241,.82);
            border-bottom:1px solid rgba(4,26,108,.08);
            backdrop-filter:blur(18px);
          }}
          .block-container {{
            max-width:1540px;
            padding:1.1rem 2.2rem 4rem;
          }}

          section[data-testid="stSidebar"] {{
            min-width:292px!important;
            max-width:292px!important;
            background:
              linear-gradient(165deg,rgba(64,66,135,.62),transparent 42%),
              linear-gradient(180deg,#071B66 0%,#041455 58%,#03103F 100%);
            border-right:0;
            box-shadow:20px 0 55px rgba(4,26,108,.12);
            overflow:hidden;
          }}
          section[data-testid="stSidebar"]::before,
          section[data-testid="stSidebar"]::after {{
            content:"";
            position:absolute;
            pointer-events:none;
            border:2px solid rgba(235,191,93,.15);
            border-radius:50%;
            transform:rotate(-18deg);
          }}
          section[data-testid="stSidebar"]::before {{
            width:330px;height:130px;left:-120px;top:96px;
          }}
          section[data-testid="stSidebar"]::after {{
            width:260px;height:110px;left:48px;top:118px;transform:rotate(56deg);
          }}
          [data-testid="stSidebar"] > div:first-child {{
            padding:1.25rem .9rem 1.5rem;
            position:relative;
            z-index:1;
          }}
          [data-testid="stSidebar"] * {{ color:#F7F5EE; }}
          .brand-wrap {{
            display:block;
            position:relative;
            padding:.4rem .55rem 1.05rem;
          }}
          .brand-wrap img {{
            display:block;
            width:188px;
            max-height:86px;
            object-fit:contain;
            object-position:left center;
            filter:drop-shadow(0 10px 24px rgba(0,0,0,.18));
          }}
          .brand-copy {{
            display:flex;
            align-items:center;
            gap:.55rem;
            margin-top:.8rem;
          }}
          .brand-copy b {{
            color:white;
            font-size:.78rem;
            letter-spacing:.13em;
          }}
          .brand-copy small {{
            color:#D7DDF0;
            font-size:.66rem;
            margin:0;
            padding-left:.55rem;
            border-left:1px solid rgba(255,255,255,.28);
          }}
          .demo-pill {{
            border:1px solid rgba(235,191,93,.32);
            background:linear-gradient(90deg,rgba(235,191,93,.16),rgba(255,255,255,.05));
            color:#FFF4D4;
            border-radius:999px;
            padding:.54rem .72rem;
            font-size:.57rem;
            letter-spacing:.12em;
            margin:0 .35rem .8rem;
          }}
          .demo-pill i {{ background:var(--y12-gold); box-shadow:0 0 0 4px rgba(235,191,93,.12); }}
          .nav-label {{
            color:#AEB9DF;
            font-size:.56rem;
            letter-spacing:.18em;
            font-weight:800;
            padding:.72rem .55rem .32rem;
          }}
          [data-testid="stSidebar"] [data-testid="stRadio"] > label {{
            display:none;
          }}
          [data-testid="stSidebar"] [role="radiogroup"] {{
            gap:.14rem;
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label {{
            min-height:42px;
            display:flex;
            align-items:center;
            padding:.58rem .7rem;
            border-radius:12px;
            border:1px solid transparent;
            background:transparent;
            transition:all .18s ease;
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label:hover {{
            background:rgba(255,255,255,.08);
            transform:translateX(2px);
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) {{
            background:linear-gradient(100deg,rgba(235,191,93,.22),rgba(207,68,39,.22));
            border-color:rgba(235,191,93,.34);
            box-shadow:0 10px 24px rgba(0,0,0,.12), inset 3px 0 var(--y12-gold);
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label > div:first-child {{
            display:none;
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label p {{
            color:#D9E0F4!important;
            font-size:.74rem!important;
            font-weight:650!important;
            letter-spacing:.01em;
          }}
          [data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) p {{
            color:white!important;
            font-weight:780!important;
          }}
          [data-testid="stSidebar"] hr {{
            margin:.9rem .3rem;
            border-color:rgba(255,255,255,.12);
          }}
          .role-card {{
            margin:.35rem .3rem .75rem;
            padding:.75rem;
            border-radius:14px;
            background:rgba(255,255,255,.07);
            border:1px solid rgba(255,255,255,.11);
          }}
          .role-card span {{
            display:block;
            color:#9EABD3;
            font-size:.52rem;
            letter-spacing:.14em;
            font-weight:800;
            margin-bottom:.18rem;
          }}
          .role-card b {{ font-size:.72rem;color:white; }}
          [data-testid="stSidebar"] .stSelectbox > label p {{
            color:#9EABD3!important;
            font-size:.56rem!important;
            letter-spacing:.11em;
            font-weight:800;
          }}
          [data-testid="stSidebar"] .stSelectbox [data-baseweb="select"] > div {{
            min-height:40px;
            background:rgba(255,255,255,.08);
            border-color:rgba(255,255,255,.14);
            border-radius:11px;
          }}
          [data-testid="stSidebar"] .stButton button {{
            color:white;
            background:rgba(255,255,255,.07);
            border-color:rgba(255,255,255,.12);
          }}
          [data-testid="stSidebar"] .stButton button:hover {{
            border-color:var(--y12-gold);
            color:var(--y12-gold);
          }}
          .powered {{
            border-top:1px solid rgba(255,255,255,.12);
            margin:.95rem .35rem 0;
            padding:1rem .2rem 0;
          }}
          .powered span {{ color:#8493C1; }}
          .powered b {{ color:#EEF1FA; font-size:.7rem; letter-spacing:.04em; }}

          .notice {{
            background:rgba(255,255,255,.72);
            border:1px solid rgba(4,26,108,.09);
            color:#67718A;
            border-radius:999px;
            padding:.48rem .82rem;
            text-align:left;
            width:max-content;
            max-width:100%;
            font-size:.62rem;
            margin:.1rem 0 1rem;
            box-shadow:0 8px 22px rgba(4,26,108,.04);
          }}
          .notice::before {{
            content:"";
            display:inline-block;
            width:7px;height:7px;border-radius:50%;
            background:var(--y12-gold);
            margin-right:.5rem;
            box-shadow:0 0 0 4px rgba(235,191,93,.19);
          }}

          .brand-masthead {{
            position:relative;
            overflow:hidden;
            min-height:248px;
            display:grid;
            grid-template-columns:minmax(0,1.45fr) minmax(285px,.75fr);
            gap:2rem;
            align-items:center;
            padding:2rem 2.2rem;
            margin:.15rem 0 1.15rem;
            color:white;
            border-radius:26px;
            background:
              radial-gradient(circle at 86% 26%,rgba(235,191,93,.34),transparent 17rem),
              linear-gradient(118deg,#041A6C 0%,#142573 49%,#404287 100%);
            box-shadow:0 28px 60px rgba(4,26,108,.20);
          }}
          .brand-masthead::before,
          .brand-masthead::after {{
            content:"";
            position:absolute;
            width:520px;height:180px;
            right:-130px;top:20px;
            border:3px solid rgba(235,191,93,.28);
            border-radius:50%;
            transform:rotate(-20deg);
          }}
          .brand-masthead::after {{
            right:-10px;top:58px;
            transform:rotate(58deg);
            border-color:rgba(240,203,124,.17);
          }}
          .masthead-copy,.masthead-feature {{ position:relative;z-index:1; }}
          .masthead-logo {{
            width:174px;
            height:auto;
            margin-bottom:1rem;
            filter:drop-shadow(0 10px 28px rgba(0,0,0,.18));
          }}
          .masthead-kicker {{
            color:var(--y12-gold);
            font-size:.61rem;
            letter-spacing:.18em;
            font-weight:850;
          }}
          .masthead-copy h1 {{
            color:white;
            font-size:2.7rem;
            line-height:1.02;
            letter-spacing:-.045em;
            max-width:720px;
            margin:.48rem 0 .62rem;
          }}
          .masthead-copy p {{
            color:#DCE3F5;
            font-size:.91rem;
            line-height:1.55;
            max-width:650px;
            margin:0;
          }}
          .masthead-chips {{ display:flex;gap:.48rem;flex-wrap:wrap;margin-top:1.1rem; }}
          .masthead-chips span {{
            border:1px solid rgba(255,255,255,.18);
            background:rgba(255,255,255,.08);
            color:#F3F5FB;
            padding:.42rem .65rem;
            border-radius:999px;
            font-size:.6rem;
          }}
          .masthead-feature {{
            background:rgba(255,255,255,.10);
            border:1px solid rgba(255,255,255,.18);
            border-radius:20px;
            padding:1.25rem;
            backdrop-filter:blur(12px);
            box-shadow:0 20px 44px rgba(0,0,0,.14);
          }}
          .masthead-feature span {{
            color:var(--y12-gold);
            font-size:.55rem;
            letter-spacing:.15em;
            font-weight:850;
          }}
          .masthead-feature strong {{
            display:block;
            font-size:2.25rem;
            color:white;
            margin:.35rem 0 .2rem;
          }}
          .masthead-feature p {{
            color:#E5E9F7;
            font-size:.65rem;
            line-height:1.5;
            margin:0 0 .9rem;
          }}
          .masthead-feature .feature-line {{
            display:flex;
            justify-content:space-between;
            gap:1rem;
            padding:.55rem 0;
            border-top:1px solid rgba(255,255,255,.14);
            font-size:.62rem;
            color:#E1E6F5;
          }}
          .masthead-feature .feature-line b {{ color:white; }}

          .page-head {{
            display:flex;
            align-items:center;
            justify-content:space-between;
            margin:.2rem 0 1.2rem;
            padding:.2rem .1rem;
          }}
          .page-head .kicker,.eyebrow {{
            color:var(--y12-red);
            font-size:.58rem;
            letter-spacing:.16em;
            font-weight:850;
          }}
          .page-head h1 {{
            color:var(--ink);
            font-size:2rem;
            letter-spacing:-.04em;
            margin:.28rem 0 .18rem;
          }}
          .page-head p {{ color:var(--muted);font-size:.78rem; }}
          .page-head-badge {{
            display:flex;
            align-items:center;
            gap:.5rem;
            padding:.52rem .68rem;
            border-radius:999px;
            background:white;
            border:1px solid var(--line);
            color:var(--y12-blue);
            font-size:.6rem;
            font-weight:750;
            box-shadow:0 8px 22px rgba(4,26,108,.06);
          }}
          .page-head-badge i {{
            width:8px;height:8px;border-radius:50%;
            background:#26A37B;
            box-shadow:0 0 0 4px rgba(38,163,123,.13);
          }}

          .metric-shell {{
            position:relative;
            min-height:122px;
            overflow:hidden;
            background:white;
            border:1px solid rgba(4,26,108,.09);
            border-radius:18px;
            padding:1rem 1.05rem;
            box-shadow:0 14px 34px rgba(4,26,108,.07);
          }}
          .metric-shell::after {{
            content:"";
            position:absolute;
            width:90px;height:90px;
            right:-34px;top:-38px;
            border-radius:50%;
            background:var(--metric-tint,#F8E8E2);
          }}
          .metric-top {{ display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1; }}
          .metric-label {{ color:#68728A;font-size:.62rem;font-weight:760; }}
          .metric-icon {{
            width:31px;height:31px;border-radius:10px;
            display:grid;place-items:center;
            color:var(--metric-color,var(--y12-red));
            background:var(--metric-tint,#F8E8E2);
            font-size:.85rem;font-weight:900;
          }}
          .metric-value {{
            position:relative;z-index:1;
            color:var(--ink);
            font-size:1.72rem;
            font-weight:850;
            letter-spacing:-.04em;
            margin:.62rem 0 .18rem;
          }}
          .metric-delta {{
            position:relative;z-index:1;
            color:#778198;
            font-size:.57rem;
          }}
          .metric-delta b {{ color:#16856B; }}

          .panel {{
            background:rgba(255,255,255,.94);
            border:1px solid rgba(4,26,108,.09);
            border-radius:20px;
            padding:1.15rem;
            box-shadow:0 16px 38px rgba(4,26,108,.065);
            margin-bottom:.95rem;
          }}
          .panel-header h3 {{ font-size:1rem; }}
          .panel-action {{ color:var(--y12-blue); }}
          .spend-wrap {{
            background:linear-gradient(145deg,#FFF 0%,#FAF7EF 100%);
            border:1px solid rgba(4,26,108,.09);
            border-radius:20px;
            padding:1.15rem 1.2rem .35rem;
            box-shadow:0 16px 38px rgba(4,26,108,.065);
          }}
          .spend-head {{ display:flex;align-items:flex-end;justify-content:space-between;gap:1rem; }}
          .spend-head span {{ color:var(--y12-red);font-size:.56rem;letter-spacing:.15em;font-weight:850; }}
          .spend-head h3 {{ color:var(--ink);font-size:1.02rem;margin:.28rem 0 .12rem; }}
          .spend-head p {{ color:var(--muted);font-size:.62rem;margin:0; }}
          .spend-total {{ text-align:right; }}
          .spend-total b {{ display:block;font-size:1.75rem;color:var(--ink); }}
          .spend-total small {{ color:#16856B;font-size:.58rem;font-weight:700; }}
          [data-testid="stVegaLiteChart"] {{
            background:transparent!important;
          }}

          .queue-row,.vendor-row,.list-row {{
            border-top:1px solid #EEECE5;
            padding:.78rem 0;
          }}
          .row-icon {{
            background:#E9ECF8;
            color:var(--y12-blue);
            border-radius:11px;
          }}
          .row-icon.coral {{ background:#F8E7E1;color:var(--y12-red); }}
          .row-icon.gold {{ background:#FBF1D6;color:#9A6514; }}
          .row-title {{ font-size:.72rem; }}
          .insight {{
            border:0;
            background:linear-gradient(135deg,#071D72,#404287);
            box-shadow:0 15px 32px rgba(4,26,108,.18);
          }}
          .insight b,.insight p {{ color:white; }}
          .insight p {{ color:#DCE2F3; }}
          .insight-icon {{
            background:linear-gradient(135deg,var(--y12-gold),var(--y12-peach));
            color:var(--y12-blue);
            box-shadow:0 8px 20px rgba(235,191,93,.24);
          }}
          .track {{ height:7px;background:#EEECE5; }}
          .track i {{ background:linear-gradient(90deg,var(--y12-blue),var(--y12-violet)); }}
          .story {{
            position:relative;
            overflow:hidden;
            background:linear-gradient(104deg,var(--y12-red),#DE6F4C);
            border-radius:19px;
            padding:1.05rem 1.2rem;
            box-shadow:0 18px 40px rgba(207,68,39,.20);
          }}
          .story::after {{
            content:"";
            position:absolute;
            width:240px;height:85px;
            right:-50px;top:-5px;
            border:2px solid rgba(255,255,255,.24);
            border-radius:50%;
            transform:rotate(-17deg);
          }}
          .story > * {{ position:relative;z-index:1; }}
          .story span {{ color:#FFE19C; }}
          .story small {{ color:#FFE7DC; }}

          .timeline {{
            border:1px solid rgba(4,26,108,.09);
            border-radius:16px;
            box-shadow:0 12px 28px rgba(4,26,108,.05);
          }}
          .step.done i {{ background:#16856B; }}
          .step.active i {{ background:var(--y12-red);border-color:var(--y12-red); }}
          .recommendation,.vendor-card,.budget-ok,.exception,.ai-result {{
            border-radius:14px;
          }}
          .vendor-card {{ background:#F7F5EF;border-color:#E8E2D7; }}
          .badge.blue {{ color:var(--y12-blue);background:#E9ECF8; }}
          .badge.gold {{ color:#8B5C11;background:#FBF0D1; }}
          .ai-hero {{
            max-width:none;
            padding:2.6rem 2rem;
            margin:.2rem 0 1.3rem;
            border-radius:24px;
            background:
              radial-gradient(circle at 76% 8%,rgba(235,191,93,.35),transparent 17rem),
              linear-gradient(125deg,#041A6C,#404287);
            color:white;
            box-shadow:0 24px 54px rgba(4,26,108,.19);
          }}
          .ai-hero h1 {{ color:white; }}
          .ai-hero p {{ color:#E0E5F4; }}
          .ai-orb {{
            background:linear-gradient(135deg,var(--y12-gold),var(--y12-peach));
            color:var(--y12-blue);
            box-shadow:0 14px 32px rgba(235,191,93,.24);
          }}
          div.stButton > button {{
            min-height:40px;
            border-radius:11px;
            font-weight:780;
            transition:all .18s ease;
          }}
          div.stButton > button:hover {{ transform:translateY(-1px);box-shadow:0 9px 22px rgba(4,26,108,.10); }}
          div.stButton > button[kind="primary"] {{
            background:linear-gradient(105deg,var(--y12-red),#DE6F4C);
            border-color:transparent;
            box-shadow:0 12px 25px rgba(207,68,39,.22);
          }}
          div.stButton > button[kind="primary"]:hover {{
            background:linear-gradient(105deg,#B93820,var(--y12-red));
            border-color:transparent;
          }}
          [data-testid="stTextInput"] input,
          [data-testid="stTextArea"] textarea,
          [data-baseweb="select"] > div {{
            border-radius:11px!important;
          }}

          @media (max-width:1100px) {{
            .brand-masthead {{ grid-template-columns:1fr;padding:1.6rem; }}
            .masthead-feature {{ display:none; }}
            .masthead-copy h1 {{ font-size:2.15rem; }}
          }}
          @media (max-width:900px) {{
            section[data-testid="stSidebar"] {{
              min-width:270px!important;
              max-width:270px!important;
            }}
            .block-container {{ padding:1rem 1.05rem 3rem; }}
            .brand-masthead {{ min-height:220px;border-radius:20px; }}
            .masthead-logo {{ width:150px; }}
            .masthead-copy h1 {{ font-size:1.85rem; }}
            .page-head-badge {{ display:none; }}
          }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_sidebar() -> None:
    with st.sidebar:
        logo_uri = asset_data_uri("y12-logo-white.png")
        st.markdown(
            f"""
            <div class="brand-wrap">
              <img src="{logo_uri}" alt="Y-12 Credit Union">
              <div class="brand-copy"><b>CATALYST</b><small>Procurement OS</small></div>
            </div>
            <div class="demo-pill"><i></i>Y-12 DEMO ENVIRONMENT</div>
            <div class="nav-label">PROCUREMENT COMMAND CENTER</div>
            """,
            unsafe_allow_html=True,
        )
        pages = [
            "Dashboard",
            "AI Procurement",
            "Purchase Requests",
            "Approvals",
            "Purchase Orders",
            "Receiving",
            "Inventory",
            "Vendors",
            "Contracts",
            "Invoices",
            "Analytics",
            "Audit Center",
        ]
        nav_labels = {
            "Dashboard": "⌂  Command Center",
            "AI Procurement": "✦  Ask Catalyst",
            "Purchase Requests": "▤  Purchase Requests",
            "Approvals": "✓  Approvals · 11",
            "Purchase Orders": "▣  Purchase Orders",
            "Receiving": "⇩  Receiving",
            "Inventory": "◫  Inventory",
            "Vendors": "◇  Vendor Intelligence",
            "Contracts": "◉  Contract Intelligence",
            "Invoices": "$  Invoice Match",
            "Analytics": "↗  Spend Intelligence",
            "Audit Center": "◎  Audit & Examiner",
        }
        chosen = st.radio(
            "Navigation",
            pages,
            index=pages.index(st.session_state.page),
            format_func=lambda page: nav_labels[page],
            label_visibility="collapsed",
        )
        if chosen != st.session_state.page:
            navigate(chosen)
            st.rerun()
        st.divider()
        st.markdown(
            """
            <div class="nav-label" style="padding-top:.1rem">PRESENTER MODE</div>
            <div class="role-card">
              <span>CONTROL STATUS</span>
              <b>Live demo · fictional data</b>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.selectbox(
            "ACTIVE DEMO ROLE",
            [
                "Purchasing Manager",
                "Employee Requester",
                "Department Manager",
                "IT Reviewer",
                "Finance Reviewer",
                "Receiving Clerk",
                "Accounts Payable",
                "Executive",
                "Auditor",
            ],
            key="role",
        )
        st.caption("Guided Tour · Coming in Phase 3")
        if st.button("↻  Reset demo experience", use_container_width=True):
            reset_demo()
            st.rerun()
        st.markdown(
            '<div class="powered"><span>POWERED BY</span><b>Catalyst Innovations · Procurement Intelligence</b></div>',
            unsafe_allow_html=True,
        )


def page_header(kicker: str, title: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="page-head">
          <div><span class="kicker">{kicker}</span><h1>{title}</h1><p>{subtitle}</p></div>
          <div class="page-head-badge"><i></i>Demo systems healthy</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_dashboard() -> None:
    logo_uri = asset_data_uri("y12-logo-white.png")
    st.markdown(
        f"""
        <section class="brand-masthead">
          <div class="masthead-copy">
            <img class="masthead-logo" src="{logo_uri}" alt="Y-12 Credit Union">
            <div class="masthead-kicker">CATALYST PROCUREMENT INTELLIGENCE</div>
            <h1>Start with why.<br>We’ll handle the purchasing how.</h1>
            <p>One intelligent workspace for requests, approvals, vendors, contracts, receiving, invoices, and every decision in between.</p>
            <div class="masthead-chips">
              <span>✦ AI-guided purchasing</span>
              <span>✓ Banking-grade controls</span>
              <span>◎ Examiner-ready evidence</span>
            </div>
          </div>
          <div class="masthead-feature">
            <span>CATALYST SAVINGS SIGNAL</span>
            <strong>$318,450</strong>
            <p>Identified year-to-date savings across contracts, inventory reuse, and sourcing decisions.</p>
            <div class="feature-line"><span>Inventory avoidance</span><b>$84,720</b></div>
            <div class="feature-line"><span>Contract leverage</span><b>$176,240</b></div>
            <div class="feature-line"><span>Duplicate prevention</span><b>$57,490</b></div>
          </div>
        </section>
        """,
        unsafe_allow_html=True,
    )

    q1, q2, q3 = st.columns([1.15, 1, 1])
    if q1.button("✦  Ask Catalyst what to buy", type="primary", use_container_width=True):
        navigate("AI Procurement")
        st.rerun()
    if q2.button("Start featured request", use_container_width=True):
        navigate("Purchase Requests")
        st.rerun()
    if q3.button("Review 11 approvals", use_container_width=True):
        navigate("Approvals")
        st.rerun()

    page_header(
        date.today().strftime("%A, %B %d").upper(),
        "Procurement command center",
        "The decisions, risks, savings, and work that need attention now.",
    )
    cols = st.columns(4, gap="medium")
    metrics = [
        ("Year-to-date spend", "$4.29M", "$212K below plan", "↗", "#E9ECF8", "#041A6C"),
        ("Identified savings", "$318K", "14.8% annualized", "$", "#F8E7E1", "#CF4427"),
        ("Awaiting approval", "11", "4 assigned to you", "✓", "#FBF0D1", "#8B5C11"),
        ("Budget utilization", "64.7%", "$2.34M available", "◔", "#E6F3EE", "#16856B"),
    ]
    for col, (label, value, delta, icon, tint, color) in zip(cols, metrics):
        col.markdown(
            f"""
            <div class="metric-shell" style="--metric-tint:{tint};--metric-color:{color}">
              <div class="metric-top"><span class="metric-label">{label}</span><span class="metric-icon">{icon}</span></div>
              <div class="metric-value">{value}</div>
              <div class="metric-delta"><b>On track</b> · {delta}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    left, right = st.columns([1.3, 1], gap="medium")
    with left:
        monthly = pd.DataFrame(
            {
                "Month": ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
                "Spend": [282, 334, 305, 389, 342, 411, 375, 452, 398, 467, 422, 487],
                "Plan": [310, 320, 335, 360, 370, 390, 400, 420, 430, 455, 470, 500],
            }
        ).set_index("Month")
        st.markdown(
            """
            <div class="spend-wrap">
              <div class="spend-head">
                <div><span>SPEND INTELLIGENCE</span><h3>Spend vs. operating plan</h3><p>12-month procurement performance</p></div>
                <div class="spend-total"><b>$4.29M</b><small>$212K below plan</small></div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.line_chart(monthly, color=[BRAND["coral"], BRAND["navy"]], height=260)
    with right:
        rows = "".join(
            [
                '<div class="queue-row"><div class="row-icon coral">IT</div><div><span class="row-title">New Loan Officer Equipment</span><span class="row-meta">PR-2026-00841 · AI recommends approve</span></div><div class="row-value">$8,745<small style="color:#CF4427">Due today</small></div></div>',
                '<div class="queue-row"><div class="row-icon gold">F</div><div><span class="row-title">Branch security camera upgrade</span><span class="row-meta">PR-2026-00838 · Facilities</span></div><div class="row-value">$24,880<small>2 days</small></div></div>',
                '<div class="queue-row"><div class="row-icon">C</div><div><span class="row-title">Annual compliance training</span><span class="row-meta">PR-2026-00829 · Contract confirmed</span></div><div class="row-value">$12,400<small>3 days</small></div></div>',
                '<div class="queue-row"><div class="row-icon coral">!</div><div><span class="row-title">Freight variance exception</span><span class="row-meta">INV-88431 · Human review required</span></div><div class="row-value">$320<small style="color:#CF4427">Exception</small></div></div>',
            ]
        )
        panel("Your decision queue", "NEEDS ATTENTION", rows, "Open work center →")

    c1, c2, c3 = st.columns([1.25, 1, 0.85], gap="medium")
    with c1:
        body = """
          <div class="insight"><div class="insight-icon">✦</div><div><b>Catalyst found $1,047 before you spent it</b><p>Three compatible monitors are already in central inventory. Reserve them and reduce the featured request instantly.</p></div></div>
          <div class="list-row"><div class="row-icon gold">!</div><div><span class="row-title">3 contracts enter notice windows</span><span class="row-meta">One has a 7% renewal escalator</span></div><div class="row-value">Review →</div></div>
          <div class="list-row"><div class="row-icon coral">!</div><div><span class="row-title">Freight variance pattern detected</span><span class="row-meta">Two invoices · same category</span></div><div class="row-value">Investigate →</div></div>
        """
        panel("Intelligence you can act on", "CATALYST AI", body)
    with c2:
        budgets = [
            ("Information Technology", 78, "$412K left"),
            ("Facilities", 71, "$286K left"),
            ("Branch Operations", 64, "$378K left"),
            ("Marketing", 58, "$194K left"),
        ]
        body = "".join(
            f'<div class="budget-line"><div class="budget-label"><span>{name}</span><b>{left}</b></div><div class="track"><i style="width:{pct}%"></i></div></div>'
            for name, pct, left in budgets
        )
        panel("Department utilization", "BUDGET HEALTH", body, "View budgets →")
    with c3:
        body = """
          <div class="budget-line"><div class="budget-label"><span>Low risk</span><b>27 vendors</b></div><div class="track"><i style="width:68%;background:#16856B"></i></div></div>
          <div class="budget-line"><div class="budget-label"><span>Moderate</span><b>9 vendors</b></div><div class="track"><i style="width:23%;background:#EBBF5D"></i></div></div>
          <div class="budget-line"><div class="budget-label"><span>High risk</span><b>4 vendors</b></div><div class="track"><i style="width:10%;background:#CF4427"></i></div></div>
          <div class="list-row"><div class="row-icon coral">4</div><div><span class="row-title">Documents need attention</span><span class="row-meta">SOC · insurance · BCP</span></div><div></div></div>
        """
        panel("Risk distribution", "VENDOR OVERSIGHT", body, "View vendors →")

    st.markdown(
        f"""
        <div class="story">
          <div><span>FEATURED LIVE STORY</span><b>New Loan Officer Equipment Package</b><small>Watch Catalyst move from a sentence to an examiner-ready transaction.</small></div>
          <strong>{money(request_total())}</strong>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Run the featured procurement story →", type="primary", use_container_width=True):
        navigate("Purchase Requests")
        st.rerun()


def timeline_html() -> str:
    active = STAGE_INDEX[st.session_state.stage]
    parts: list[str] = []
    for idx, label in enumerate(STAGES):
        state = "done" if idx < active else "active" if idx == active else ""
        icon = "✓" if idx < active else str(idx + 1)
        parts.append(f'<div class="step {state}"><i>{icon}</i><span>{label}</span></div>')
    return f'<div class="timeline">{"".join(parts)}</div>'


def recommendation_html(
    title: str, detail: str, saving: str, accepted: bool, gold: bool = False
) -> str:
    tone = " gold" if gold else ""
    state = badge("✓ ACCEPTED", "green") if accepted else badge("AVAILABLE", "blue")
    return dedent(
        f"""
        <div class="recommendation{tone}">
          <div class="row-icon">{"↔" if gold else "▦"}</div>
          <div><h4>{title}</h4><p>{detail}</p></div>
          <div class="saving">{saving}<br>{state}</div>
        </div>
        """
    ).strip()


def render_workflow() -> None:
    title_map = {
        "draft": ("AI REQUEST ASSISTANT", "Build the request"),
        "submitted": ("4-STEP WORKFLOW", "Approval center"),
        "approved": ("ALL APPROVALS COMPLETE", "Ready to purchase"),
        "po": ("Y12-PO-2026-00482", "Purchase order issued"),
        "received": ("RECEIVING WORKSPACE", "Record delivery"),
        "exception": ("THREE-WAY MATCH", "Invoice exception"),
    }
    kicker, title = title_map[st.session_state.stage]
    page_header(kicker, title, "New Loan Officer Equipment Package · PR-2026-00841")
    st.markdown(timeline_html(), unsafe_allow_html=True)

    main, side = st.columns([3.2, 1], gap="medium")
    with main:
        st.markdown(
            dedent(
                f"""
            <div class="panel">
              <div class="request-title">
                <div><span class="eyebrow">FEATURED SCENARIO</span><h2>New Loan Officer Equipment Package</h2><p>“We are hiring three new loan officers and need laptops, monitors, docking stations, headsets, and office chairs before August 17.”</p></div>
                <div class="request-total"><small>RECOMMENDED TOTAL</small><b>{money(request_total())}</b>{badge("$1,131 IDENTIFIED SAVINGS", "green")}</div>
              </div>
              <div class="request-meta">
                <div><small>REQUESTER</small><b>Maya Collins</b></div>
                <div><small>DEPARTMENT</small><b>Information Technology</b></div>
                <div><small>DELIVER TO</small><b>Oak Ridge Operations</b></div>
                <div><small>NEEDED BY</small><b>August 17, 2026</b></div>
              </div>
              <div class="section-label">INTELLIGENT RECOMMENDATIONS</div>
              {recommendation_html("Use 3 monitors from central inventory", "Six requested; three compatible Dell P2425H monitors are available and can be reserved.", "Saves $1,047", st.session_state.inventory)}
              {recommendation_html("Substitute approved headset standard", "Replace the requested model with the approved Jabra Evolve2 40 standard.", "Saves $84", st.session_state.headset, True)}
              <div class="section-label">SOURCING RECOMMENDATION</div>
              <div class="vendor-card">
                <div class="row-icon">VT</div>
                <div><h4>Volunteer Technology Partners</h4><p>Preferred · Contract pricing · 2-day delivery</p></div>
                <div class="vendor-score"><small>VALUE SCORE</small><b>94</b></div>
                <div class="vendor-price"><b>{money(request_total())}</b><small>Recommended award</small></div>
              </div>
              <div class="budget-ok"><i>✓</i><div><b>Budget available</b><small>IT Equipment · 78% utilized after request · $403,255 remaining</small></div></div>
            </div>
            """,
            ).strip(),
            unsafe_allow_html=True,
        )

        r1, r2 = st.columns(2)
        st.session_state.inventory = r1.toggle(
            "Allocate 3 inventory monitors",
            value=st.session_state.inventory,
        )
        st.session_state.headset = r2.toggle(
            "Use approved headset standard",
            value=st.session_state.headset,
        )

        stage = st.session_state.stage
        if stage == "draft":
            if st.button("Submit for approval →", type="primary", use_container_width=True):
                advance("submitted", "Request submitted and approvals assigned.")
                st.rerun()
        elif stage == "submitted":
            st.info(
                f"Viewing as **{st.session_state.role}** · AI recommendation: Approve. "
                "Budget, standards, risk, and sourcing checks passed."
            )
            a, b, c = st.columns([1, 1, 2])
            if a.button("Return"):
                advance("draft", "Request returned to requester.")
                st.rerun()
            if b.button("Reject"):
                st.session_state.toast = "Request rejected in the demo."
                st.rerun()
            if c.button("✓ Approve request", type="primary", use_container_width=True):
                advance("approved", "All four required approvals completed.")
                st.rerun()
        elif stage == "approved":
            st.success("Four required approvals are complete.")
            if st.button("Create purchase order →", type="primary", use_container_width=True):
                advance("po", "Purchase order Y12-PO-2026-00482 issued.")
                st.rerun()
        elif stage == "po":
            st.success(
                "**Y12-PO-2026-00482** issued to Volunteer Technology Partners. "
                "Vendor acknowledgment recorded."
            )
            if st.button("Record receipt →", type="primary", use_container_width=True):
                advance("received", "Receiving workspace opened.")
                st.rerun()
        elif stage == "received":
            st.markdown(
                """
                <div class="panel"><b>Items received in full</b>
                <p class="subtle">3 laptops · 3 monitors · 3 docks · 3 headsets · 3 chairs</p>
                <div class="budget-ok"><i>✓</i><div><b>Condition recorded</b><small>One monitor had minor packaging damage and was accepted after inspection.</small></div></div>
                </div>
                """,
                unsafe_allow_html=True,
            )
            if st.button(
                "Complete receipt & match invoice →",
                type="primary",
                use_container_width=True,
            ):
                advance("exception", "Three-way match completed; freight variance found.")
                st.rerun()
        else:
            st.markdown(
                """
                <div class="exception"><i>!</i><div><b>$320 freight variance requires review</b>
                <small>Invoice INV-88431 includes freight absent from the approved quote and purchase order.</small></div></div>
                """,
                unsafe_allow_html=True,
            )
            a, b = st.columns(2)
            if a.button("Request corrected invoice", use_container_width=True):
                st.session_state.toast = "Corrected invoice requested from vendor."
                st.rerun()
            if b.button("Route for approval →", type="primary", use_container_width=True):
                st.session_state.toast = "Exception routed to Finance for review."
                st.rerun()

    with side:
        body = """
          <div class="insight"><div class="insight-icon">✦</div><div><b>Ready with controls</b><p>This request is within budget, uses approved standards, and avoids an unnecessary purchase.</p></div></div>
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">3 monitors reserved</span><span class="row-meta">Central IT Storage</span></div><div></div></div>
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">1 standard substitution</span><span class="row-meta">Jabra Evolve2 40</span></div><div></div></div>
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">4 required approvals</span><span class="row-meta">No policy exceptions</span></div><div></div></div>
        """
        panel("Demo AI summary", "CATALYST INTELLIGENCE", body)
        body = """
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">Scenario loaded</span><span class="row-meta">Daniel Harper · 9:02 AM</span></div><div></div></div>
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">Recommendations generated</span><span class="row-meta">Catalyst Demo AI · 9:03 AM</span></div><div></div></div>
          <div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">Inventory checked</span><span class="row-meta">Central Supply · 9:03 AM</span></div><div></div></div>
        """
        panel("Latest activity", "AUDIT HISTORY", body)


def render_ai() -> None:
    st.markdown(
        """
        <div class="ai-hero">
          <div class="ai-orb">✦</div><span class="eyebrow">CATALYST DEMO AI</span>
          <h1>What does your department need?</h1>
          <p>Describe it naturally. I’ll check standards, inventory, vendors, budget, and policy.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    prompt = st.text_area(
        "Purchase request",
        "We are hiring three new loan officers and need laptops, monitors, docking stations, headsets, and office chairs before August 17.",
        height=110,
        label_visibility="collapsed",
    )
    if st.button("Analyze request ✦", type="primary", use_container_width=True):
        st.session_state.ai_sent = bool(prompt.strip())
    if st.session_state.ai_sent:
        st.markdown(
            """
            <div class="ai-result"><div class="insight-icon">✦</div><div><b>I’ve structured the request and found two savings opportunities.</b>
            <p>Three monitors are already in central inventory, and the approved headset standard costs less. The request is within budget.</p></div></div>
            """,
            unsafe_allow_html=True,
        )
        if st.button("Review structured request →", use_container_width=True):
            navigate("Purchase Requests")
            st.rerun()
    st.markdown('<div class="section-label">SUGGESTED QUESTIONS</div>', unsafe_allow_html=True)
    cols = st.columns(2)
    prompts = [
        "What requests are waiting on me?",
        "Which invoices have exceptions?",
        "Show contracts expiring in 90 days",
        "Where can we reduce costs?",
    ]
    for idx, text in enumerate(prompts):
        cols[idx % 2].button(text, use_container_width=True)


def render_audit() -> None:
    page_header(
        "EXAMINER-READY EVIDENCE",
        "Audit Center",
        "Every decision, recommendation, and state change in one immutable-style history.",
    )
    f1, f2, f3 = st.columns([2, 1, 1])
    f1.text_input("Search", placeholder="Search events, records, or users…", label_visibility="collapsed")
    f2.selectbox("Event type", ["All event types", "Request", "Approval", "Purchase order"], label_visibility="collapsed")
    f3.selectbox("Period", ["This month", "This quarter", "This year"], label_visibility="collapsed")
    events = [
        ("Scenario loaded", "Daniel Harper · Requester", "9:02 AM"),
        ("AI recommendations generated", "Catalyst Demo AI", "9:03 AM"),
        ("Inventory availability checked", "Central Supply", "9:03 AM"),
        ("Inventory allocation accepted", "Maya Collins · Requester", "9:05 AM"),
        ("Approved-standard substitution accepted", "Maya Collins · Requester", "9:06 AM"),
        ("Vendor recommendation generated", "Catalyst Demo AI", "9:07 AM"),
    ]
    if st.session_state.stage != "draft":
        events.extend(
            [
                ("Request submitted", "Maya Collins · Requester", "9:08 AM"),
                ("Approval workflow generated", "Catalyst Workflow", "9:08 AM"),
            ]
        )
    body = "".join(
        f'<div class="list-row"><div class="row-icon">✓</div><div><span class="row-title">{event}</span><span class="row-meta">{actor} · PR-2026-00841</span></div><div class="row-value">{time}<small>Verified</small></div></div>'
        for event, actor, time in events
    )
    panel("Audit events", "COMPLETE HISTORY", body, "Export package ↓")


def render_module(name: str) -> None:
    page_header(
        "PROCUREMENT INTELLIGENCE",
        name,
        "Connected, actionable information from across the purchasing lifecycle.",
    )
    datasets = {
        "Inventory": [
            ("Dell P2425H Monitor", "18 available", "Central IT Storage", "▦"),
            ("Receipt paper, thermal", "240 cases", "Central Supply", "▦"),
            ("Jabra Evolve2 40", "12 available", "IT Storage", "▦"),
            ("Teller cash straps", "84 boxes", "Branch Supply", "▦"),
        ],
        "Vendors": [
            ("Volunteer Technology Partners", "94 · Low risk", "$486,220 spend", "VT"),
            ("RidgeLine Office Supply", "88 · Low risk", "$218,460 spend", "RO"),
            ("Summit Facilities Group", "76 · Moderate", "$341,890 spend", "SF"),
            ("East Tennessee Document Services", "62 · Review", "$184,200 spend", "ET"),
        ],
        "Contracts": [
            ("Enterprise Technology Supply Agreement", "Renews Oct 18", "Volunteer Technology Partners", "◫"),
            ("Document Management Services", "Notice due Sep 15", "East Tennessee Document Services", "◫"),
            ("Facilities Maintenance MSA", "Renews Dec 1", "Summit Facilities Group", "◫"),
            ("Office Supply Purchasing Agreement", "Renews Feb 28", "RidgeLine Office Supply", "◫"),
        ],
        "Analytics": [
            ("Spend under contract", "86.4%", "↑ 4.2%", "⌁"),
            ("Average approval cycle", "1.8 days", "↓ 0.6 days", "⌁"),
            ("Invoice match rate", "92.7%", "↑ 2.1%", "⌁"),
            ("Supplier consolidation", "$42,800 opportunity", "AI identified", "⌁"),
        ],
        "Purchase Orders": [
            ("Y12-PO-2026-00482", "Issued", "Volunteer Technology Partners", "PO"),
            ("Y12-PO-2026-00479", "Partially received", "RidgeLine Office Supply", "PO"),
            ("Y12-PO-2026-00471", "Acknowledged", "Summit Facilities Group", "PO"),
            ("Y12-PO-2026-00464", "Closed", "Atomic City Printworks", "PO"),
        ],
        "Receiving": [
            ("Y12-PO-2026-00482", "Expected Aug 12", "Oak Ridge Operations", "⇩"),
            ("Y12-PO-2026-00479", "Partial receipt", "Central Supply", "⇩"),
            ("Y12-PO-2026-00471", "Overdue 2 days", "Corporate Office", "⇩"),
            ("TR-2026-00184", "Internal transfer", "IT Storage → Oak Ridge", "⇩"),
        ],
        "Invoices": [
            ("INV-88431", "Exception · $320 freight", "Volunteer Technology Partners", "$"),
            ("INV-88392", "Matched", "RidgeLine Office Supply", "$"),
            ("INV-88380", "Awaiting approval", "Summit Facilities Group", "$"),
            ("INV-88371", "Ready for payment", "Atomic City Printworks", "$"),
        ],
        "Approvals": [
            ("PR-2026-00841", "Due today", "New Loan Officer Equipment", "✓"),
            ("PR-2026-00838", "Due in 2 days", "Branch security camera upgrade", "✓"),
            ("PR-2026-00829", "Due in 3 days", "Annual compliance training", "✓"),
            ("PR-2026-00817", "Overdue", "Facilities maintenance renewal", "✓"),
        ],
    }
    rows = datasets.get(name, datasets["Analytics"])
    search = st.text_input("Search", placeholder=f"Search {name.lower()}…", label_visibility="collapsed")
    if search:
        rows = [row for row in rows if search.lower() in " ".join(row).lower()]
    body = "".join(
        f'<div class="vendor-row"><div class="row-icon">{icon}</div><div><span class="row-title">{title}</span><span class="row-meta">{meta}</span></div><div class="row-value">{value}<small>Open record →</small></div></div>'
        for title, value, meta, icon in rows
    )
    panel(f"{name} overview", f"{len(rows)} ACTIVE RECORDS", body)


def render_app() -> None:
    init_state()
    inject_css()
    inject_premium_css()
    render_sidebar()

    st.markdown(
        '<div class="notice">Fictional demonstration data · Personalized concept environment · Not connected to Y-12 Credit Union systems</div>',
        unsafe_allow_html=True,
    )
    if st.session_state.toast:
        st.toast(st.session_state.toast, icon="✅")
        st.session_state.toast = ""

    page = st.session_state.page
    if page == "Dashboard":
        render_dashboard()
    elif page == "AI Procurement":
        render_ai()
    elif page == "Purchase Requests":
        render_workflow()
    elif page == "Audit Center":
        render_audit()
    elif page in {"Approvals", "Purchase Orders", "Receiving", "Invoices"}:
        # The featured connected record remains one click away from lifecycle lists.
        render_module(page)
        if st.button("Open featured workflow →", type="primary"):
            navigate("Purchase Requests")
            st.rerun()
    else:
        render_module(page)


render_app()

