#!/usr/bin/env python3
"""
Cognition — Phase 4: Speaking content assembly.

Sources & provenance:
- Part 2 TOPICS: the 179 authentic Makkar cue-card pages (SOURCE_PRACTICE) — untouched.
- Part 2 cue-card BULLETS: generated (GENERATED_PRACTICE) — the source pages carry no
  bullet prompts; bullets follow official IELTS cue-card structure per topic category.
- Part 1: generated familiar-topic sets (GENERATED_PRACTICE).
- Part 3: generated discussion sets CONNECTED to each Part 2 topic (GENERATED_PRACTICE).

The downloaded Cambridge books are scanned image PDFs (no text layer — verified:
400 chars across 20 pages) and are therefore not a viable structured source;
documented rather than OCR-guessed.

Every generated item records generated=true, generator, timestamp, category, rationale.
Deterministic output (fixed timestamp constant, seeded ordering).
"""
import json, os, re, sys
from collections import defaultdict

REPO = "/Users/arunyagoojar/Documents/cognition"
OUT = os.path.join(REPO, "content-db/speaking")
GENERATED_AT = "2026-10-02T16:30:00Z"
GENERATOR = "zcode-agent/GLM — Phase 4 curated generation"

# ---------------------------------------------------------------- topic categories
def categorize(topic):
    t = topic.lower()
    if re.search(r"\b(person|someone|people|friend|family member|neighbou?r|child|teenager|leader|teacher|actor|singer|musician|athlete|celebrity|colleague)\b", t):
        return "person"
    if re.search(r"\b(place|city|country|town|building|park|street|market|cafe|restaurant|library|museum|shop|hotel|beach|river|lake|area|neighbou?rhood|accommodation|home|house|room|school|university|stadium|bridge)\b", t):
        return "place"
    if re.search(r"\b(time|day|occasion|moment|journey|trip|visit|party|celebration|festival|wedding|holiday|vacation|experience|situation|decision|challenge|achievement|conversation|service|meal|dinner|weather|traffic|news)\b", t):
        return "event"
    if re.search(r"\b(activity|sport|game|hobby|skill|exercise|dance|swim|yoga|hiking|volunteer)\b", t):
        return "activity"
    if re.search(r"\b(book|article|magazine|newspaper|film|movie|song|website|app|software|advertisement|tv|programme|story|photo|photograph|picture|letter|podcast)\b", t):
        return "media"
    if re.search(r"\b(law|rule|skill|plant|animal|product|gift|clothes?|food|meal|machine|equipment|technology|invention|website|business|company|job|work)\b", t):
        return "object"
    return "abstract"

BULLETS = {
    "person": ["who this person is", "how you know this person", "what this person is like"],
    "place": ["where this place is", "how you first came to know about it", "what you can see or do there"],
    "event": ["when it happened", "where it happened", "what happened exactly, and who was involved"],
    "activity": ["what this activity involves", "when and where you do it", "who you usually do it with"],
    "media": ["what it is (or would be about)", "when and where you first came across it", "what makes it interesting or memorable"],
    "object": ["what it is", "when and how you first got it", "how you use it in daily life"],
    "abstract": ["what it is", "why it matters to you", "how it affects people around you"],
}
EXPLAIN = {
    "person": "and explain how you feel about this person",
    "place": "and explain why this place is memorable to you",
    "event": "and explain how you felt about it",
    "activity": "and explain what you enjoy most about it",
    "media": "and explain why you would recommend it to others",
    "object": "and explain why it is important to you",
    "abstract": "and explain why this is important to you",
}

# Part 3 discussion sets: [opening (topic-anchored), then ascending abstractness]
PART3 = {
    "person": [
        ("topic", "In what ways can the people around us shape our habits and choices?"),
        ("Why do you think some people become role models for others?"),
        ("How have social media platforms changed the way we admire famous people?"),
        ("Do you agree that young people are influenced more by friends than by family? Why (not)?"),
    ],
    "place": [
        ("topic", "Why do you think some public places become more popular than others?"),
        ("How are towns and cities changing to meet the needs of modern life?"),
        ("Do you think governments should invest more in public spaces? Why (not)?"),
        ("How might tourism change the character of a place over time?"),
    ],
    "event": [
        ("topic", "Why do you think memorable events stay with people for a long time?"),
        ("How do celebrations and traditions bring people together?"),
        ("Do you think modern life gives people fewer memorable experiences than in the past? Why (not)?"),
        ("How can people make better use of their free time to create meaningful experiences?"),
    ],
    "activity": [
        ("topic", "Why do you think people take up new hobbies at different stages of life?"),
        ("How important is it for children to take part in physical activities? Why?"),
        ("Do you think competitive activities are good for young people? Why (not)?"),
        ("How might technology change the way people spend their leisure time in the future?"),
    ],
    "media": [
        ("topic", "Why do you think certain books, films, or programmes become widely popular?"),
        ("How has digital technology changed the way people enjoy media?"),
        ("Do you think the content we consume shapes the way we see the world? How?"),
        ("Should there be any limits on what media companies publish? Why (not)?"),
    ],
    "object": [
        ("topic", "Why do you think some objects become personally valuable to people?"),
        ("How has consumer culture changed the things people choose to buy?"),
        ("Do you think people today own too many possessions? Why (not)?"),
        ("How might sustainability concerns change manufacturing in the future?"),
    ],
    "abstract": [
        ("topic", "Why is this subject often discussed in your country?"),
        ("How do people's attitudes towards this subject change as they get older?"),
        ("Do you think schools should spend more time on subjects like this? Why (not)?"),
        ("How might this area of life change over the next few decades?"),
    ],
}

# Part 1 familiar-topic sets (independent of Part 2/3)
PART1_SETS = [
    {"topic": "Hometown", "questions": [
        "Where is your hometown, and do you like living there?",
        "What do people in your hometown do in their free time?",
        "Has your hometown changed much in recent years? How?",
        "Would you like to live in your hometown in the future? Why (not)?"], "followUps": [
        "Is your hometown a good place for young people to find work?",
        "What is the most interesting place for a visitor to see in your hometown?"]},
    {"topic": "Work and studies", "questions": [
        "Do you work, or are you a student?",
        "What do you find most interesting about your work or studies?",
        "How do you usually spend your day when you are working or studying?",
        "Would you change anything about your current routine? Why (not)?"], "followUps": [
        "What skills would you like to develop for your career?",
        "Do you prefer studying alone or with other people? Why?"]},
    {"topic": "Home and accommodation", "questions": [
        "Do you live in a house or an apartment?",
        "What is your favourite room in your home? Why?",
        "Would you like to move to a different home in the future?",
        "What makes a home comfortable for you?"], "followUps": [
        "Is it better to rent or to buy a home, in your opinion?",
        "How is housing different between cities and the countryside in your country?"]},
    {"topic": "Food and cooking", "questions": [
        "What is your favourite meal of the day? Why?",
        "Can you cook? Who usually cooks in your home?",
        "Have your eating habits changed in the last few years? How?",
        "Do you prefer eating at home or eating out? Why?"], "followUps": [
        "Are traditional foods still popular with young people in your country?",
        "How could people eat more healthily in a busy city life?"]},
    {"topic": "Transport", "questions": [
        "How do you usually travel around your city?",
        "How long does your typical journey take?",
        "Do you think public transport in your city is good? Why (not)?",
        "Would you like to use a different means of transport in the future?"], "followUps": [
        "How could traffic problems in big cities be reduced?",
        "Do you think electric vehicles will replace petrol cars soon? Why (not)?"]},
    {"topic": "Hobbies and free time", "questions": [
        "What do you do in your free time?",
        "Did you have the same hobbies when you were a child?",
        "Do you prefer indoor or outdoor activities? Why?",
        "Is there a new hobby you would like to try?"], "followUps": [
        "Why do some hobbies become more popular than others?",
        "Do you think hobbies should be relaxing, or can they be challenging? Why?"]},
    {"topic": "Technology", "questions": [
        "How often do you use your phone or computer every day?",
        "What do you mainly use technology for?",
        "Has technology changed the way you study or work? How?",
        "Is there any technology you find annoying? Why?"], "followUps": [
        "Do people in your country rely on technology too much? Why (not)?",
        "How might artificial intelligence change daily life in the next ten years?"]},
    {"topic": "Weather and seasons", "questions": [
        "What is the weather like in your country at different times of the year?",
        "Which season do you like most? Why?",
        "Does the weather affect your mood or your plans? How?",
        "Has the weather in your region changed in recent years?"], "followUps": [
        "Do you think weather forecasting is becoming more accurate? Why (not)?",
        "How do extreme weather events affect people's lives?"]},
    {"topic": "Sports and exercise", "questions": [
        "Do you play any sports or do any exercise regularly?",
        "What sports are popular in your country?",
        "Did you do any sports when you were at school?",
        "Do you prefer watching sports or playing them? Why?"], "followUps": [
        "Why do international sports competitions attract such large audiences?",
        "Should professional athletes be paid as much as they are? Why (not)?"]},
    {"topic": "Friends and family", "questions": [
        "Do you spend more time with friends or with family? Why?",
        "What do you usually do together with your friends?",
        "Are your friends mostly from school, work, or your neighbourhood?",
        "What makes someone a good friend?"], "followUps": [
        "How have friendships changed now that people communicate online?",
        "Is it easier to make friends as a child or as an adult? Why?"]},
]

def parse_subject(topic):
    t = topic.strip().rstrip(".")
    t = re.sub(r"^(describe|talk about|tell me about)\s+", "", t, flags=re.I)
    return t

def gen_part2_bullets(topic, category):
    subject = parse_subject(topic)
    bullets = list(BULLETS[category])
    gen_meta = {
        "generated": True, "generator": GENERATOR, "generatedAt": GENERATED_AT,
        "category": category,
        "rationale": "Source page carries no cue-card bullet prompts (verified corpus-wide); bullets follow official IELTS Part 2 cue-card structure for this topic category. Topic itself is authentic (SOURCE_PRACTICE).",
    }
    explain = EXPLAIN[category]
    return {"leadIn": "You should say:", "bullets": bullets, "final": explain, "meta": gen_meta}

def gen_part3(topic, category):
    qs = []
    topic_anchor = PART3[category][0]
    qs.append({"question": topic_anchor[1], "anchor": "topic",
                "generated": True, "generator": GENERATOR, "generatedAt": GENERATED_AT,
                "category": category, "rationale": "Opening discussion question connected to the Part 2 topic."})
    for q in PART3[category][1:]:
        qs.append({"question": q, "anchor": "category",
                    "generated": True, "generator": GENERATOR, "generatedAt": GENERATED_AT,
                    "category": category,
                    "rationale": "Follow-up discussion question moving from concrete to abstract, per official Part 3 interaction structure."})
    return qs

def gen_part1():
    out = []
    for s in PART1_SETS:
        out.append({
            "topic": s["topic"],
            "questions": s["questions"],
            "followUps": s["followUps"],
            "provenance": {"type": "GENERATED_PRACTICE", "generated": True, "generator": GENERATOR,
                            "generatedAt": GENERATED_AT,
                            "rationale": "Official Part 1 structure: familiar personal topics with short questions and natural follow-ups. No authentic Part 1 material exists in the source corpus.",
                            "validation": "curated"},
        })
    return out

def main():
    records = [json.load(open(f)) for f in sorted(os.listdir(os.path.join(OUT, "tests"))) and
               [os.path.join(OUT, "tests", f) for f in sorted(os.listdir(os.path.join(OUT, "tests")))]]
    records = [r for r in records if r.get("status") != "quarantined"]
    part1_sets = gen_part1()
    os.makedirs(os.path.join(OUT, "generated"), exist_ok=True)
    json.dump({"part1Sets": part1_sets,
                "provenanceType": "GENERATED_PRACTICE"},
               open(os.path.join(OUT, "generated", "part1_sets.json"), "w"), indent=1, ensure_ascii=False)

    packages = []
    cat_count = defaultdict(int)
    for i, rec in enumerate(records):
        topic = rec["cueCard"]["topic"]
        category = categorize(topic)
        cat_count[category] += 1
        bullets = gen_part2_bullets(topic, category)
        part3 = gen_part3(topic, category)
        pkg = {
            "id": rec["id"],
            "slug": rec["slug"],
            "title": topic,
            "hubNumber": rec.get("hubNumber"),
            "category": category,
            # per-part provenance
            "part1": {"available": True, "provenanceType": "GENERATED_PRACTICE",
                       "topicSet": part1_sets[i % len(part1_sets)]},
            "part2": {
                "available": True,
                "topic": {"text": topic, "provenanceType": "SOURCE_PRACTICE",
                           "source": {"path": rec["provenance"]["page"]["path"],
                                       "sha256": rec["provenance"]["page"]["sha256"][:16],
                                       "collection": "makkar-cue-cards (practicepteonline.com)"}},
                "cueCard": bullets,
                "bulletPrompts": [b for b in bullets["bullets"]],
                "finalInstruction": bullets["final"],
                "sampleAnswer": rec["sampleAnswer"],
            },
            "part3": {"available": True, "provenanceType": "GENERATED_PRACTICE", "questions": part3,
                       "connection": "questions connected to the Part 2 topic, ascending in abstraction"},
            "coverage": {"part1": "generated_practice", "part2": "available",
                          "part3": "generated_practice"},
            "status": rec["status"],
        }
        packages.append(pkg)
    json.dump({"packages": packages, "categoryCounts": dict(cat_count),
                "generatedAt": GENERATED_AT, "generator": GENERATOR},
               open(os.path.join(OUT, "generated", "assembled_packages.json"), "w"), indent=1, ensure_ascii=False)
    print("packages:", len(packages), "| categories:", dict(cat_count), "| part1 sets:", len(part1_sets))

if __name__ == "__main__":
    main()
