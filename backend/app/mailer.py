"""Sending the morning brief over SMTP.

Every setting comes from the environment, so no credential is ever committed:

    SMTP_HOST       smtp.office365.com    (unset = sending is off)
    SMTP_PORT       587
    SMTP_USER       mailbox to authenticate as (unset = no AUTH)
    SMTP_PASSWORD   its password, or an app password
    SMTP_FROM       the From address (defaults to SMTP_USER)
    SMTP_FROM_NAME  display name for the From address
    SMTP_SECURITY   starttls (default) | ssl | none
    SMTP_TIMEOUT    seconds to wait on the server, default 30

`configured()` stays False until SMTP_HOST is set, and the scheduler reports
that rather than pretending a send happened.
"""

from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid


class MailNotConfigured(RuntimeError):
    """SMTP settings are missing, so nothing can be sent."""


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def sender() -> str:
    return _env("SMTP_FROM") or _env("SMTP_USER")


def configured() -> bool:
    """A host alone is not enough: without a From address nothing can be sent,
    so status must not claim otherwise."""
    return bool(_env("SMTP_HOST") and sender())


def settings() -> dict:
    """What is configured, for /api/digest/status. Never includes the password."""
    try:
        port = int(_env("SMTP_PORT", "587"))
    except ValueError:
        port = 587

    return {
        "configured": configured(),
        "host": _env("SMTP_HOST"),
        "port": port,
        "security": _env("SMTP_SECURITY", "starttls").lower(),
        "user": _env("SMTP_USER"),
        "from": sender(),
        "authenticates": bool(_env("SMTP_USER") and _env("SMTP_PASSWORD")),
    }


def send(subject: str, html: str, text: str, recipients: list[str]) -> dict:
    """Deliver one message. Raises on any SMTP failure; the caller records it."""
    if not configured():
        raise MailNotConfigured(
            "Mail is not configured: set SMTP_HOST and SMTP_USER (or SMTP_FROM)."
        )
    if not recipients:
        raise ValueError("The schedule has no recipients.")

    from_addr = sender()
    if not from_addr:
        raise MailNotConfigured("Set SMTP_FROM (or SMTP_USER) to a From address.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((_env("SMTP_FROM_NAME", "Campaign Performance Tracker"), from_addr))
    msg["To"] = ", ".join(recipients)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=from_addr.rpartition("@")[2] or None)
    # Plain text first, HTML second: a multipart/alternative in that order lets
    # every client pick the richest part it can render.
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    cfg = settings()
    security = cfg["security"]
    try:
        timeout = float(_env("SMTP_TIMEOUT", "30"))
    except ValueError:
        timeout = 30.0

    if security == "ssl":
        client = smtplib.SMTP_SSL(
            cfg["host"], cfg["port"], timeout=timeout, context=ssl.create_default_context()
        )
    else:
        client = smtplib.SMTP(cfg["host"], cfg["port"], timeout=timeout)

    with client as c:
        c.ehlo()
        if security == "starttls":
            c.starttls(context=ssl.create_default_context())
            c.ehlo()

        user, password = _env("SMTP_USER"), _env("SMTP_PASSWORD")
        if user and password:
            c.login(user, password)

        refused = c.send_message(msg, from_addr=from_addr, to_addrs=recipients)

    return {
        "recipients": list(recipients),
        "refused": {addr: str(err) for addr, err in (refused or {}).items()},
    }
