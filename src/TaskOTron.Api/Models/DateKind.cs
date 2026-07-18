namespace TaskOTron.Api.Models;

/// <summary>
/// Two date kinds per task, ported from the prototype (Tasks.dc.html).
/// <see cref="Due"/> ("Do it by") participates in Today/Upcoming smart lists and can be overdue.
/// <see cref="Transaction"/> is a fixed historical date, never overdue, excluded from smart lists.
/// </summary>
public enum DateKind
{
    Due,
    Transaction,
}
