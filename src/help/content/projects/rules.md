---
title: Rules: let the board do routine steps
summary: When something happens to a task, PMT does what you set, such as assigning a tester.
who: admins
minutes: 3
app: /projects
appLabel: Projects
keywords: rules, automation, automatic, when then, assign, notify, testing, overdue
---
A rule says **when** something happens, **then** do this. For example: *when a task moves to Testing, assign Kiran and tell the project managers.*

## 1. See the rules

![The Rules tab](1-rules.webp "Each rule in plain words, with an on/off switch")

Open the project and click **Rules**.

- [[1]] **New rule** adds one.
- [[2]] Each rule in plain words, and when it last ran.
- [[3]] The switch turns a rule off without deleting it. The pencil changes it; the bin deletes it.

## 2. Add a rule

![A new rule](2-new-rule.webp "When, only if, then")

1. **When** [[1]]: what starts it: a task moves to a column, a task is created, someone is assigned, a task is due tomorrow, or a task is overdue.
2. **Only if** [[2]] (optional): narrow it down, for example only *Urgent* tasks or a label.
3. **Then** [[3]]: what PMT does: assign someone, notify people, move the task to a column, set its priority, add a label or add a follower. **Add another action** to do more than one thing.
4. Save the rule.

:::note Only Admins
Only Admins can add, change or switch off rules. Everyone else on the project can see them.
:::
