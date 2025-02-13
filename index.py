from flask import Flask, request, jsonify
from flask_cors import CORS 
from deepgram import DeepgramClient, PrerecordedOptions
import os
import google.generativeai as genai
# semib69051@perceint.com

app = Flask(__name__)
CORS(app)
CORS(app, resources={r"/process-audio": {"origins": "http://localhost"}}) ## connect the website to the backend (script)

#app = Flask(__name__)
DEEPGRAM_API_KEY = '7902c5cc1a76c252b7381d2ce059a9fbbb972889'
deepgram = DeepgramClient(DEEPGRAM_API_KEY)


@app.route('/') # the local host itself
def home():
    return "server working"

@app.route('/process-audio', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    audio_path = os.path.join("uploads", audio_file.filename)
    audio_file.save(audio_path)

    with open(audio_path, 'rb') as buffer_data:
        payload = {'buffer': buffer_data}
        options = PrerecordedOptions(
            smart_format=True, model="nova-2", language="en-US", filler_words=True, diarize=True
        )
        response = deepgram.listen.prerecorded.v('1').transcribe_file(payload, options)

    fResponse = response.to_json()
    
    transcript = response["results"]["channels"][0]["alternatives"][0]["transcript"] #Transcript 
    confidence = response["results"]["channels"][0]["alternatives"][0]["confidence"]
    # print(transcript)
    # print(confidence)

    index = 0
    transcriptStr = ""

    for i in range(len(fResponse)-17): 
        if fResponse[i:i+17] == "\"transcript\": \"\\n":
            index = i+17
            break
    
    while fResponse[index:index+2] != "\",":
        transcriptStr += fResponse[index]
        index += 1

    newtranscript1 = transcriptStr.replace("\n", "")
    newtranscript2 = ""
    for i in range(len(newtranscript1)): 
        if newtranscript1[i:i+7] == "Speaker" and i != 0:
            newtranscript2 += "\n"
        newtranscript2 += newtranscript1[i]

    newtranscript2 = newtranscript2.replace("Speaker 1", "Speaker")
    newtranscript2 = newtranscript2.replace("Speaker 0", "Speaker")
    
    # print(newtranscript2)

    ## number of speakers checker
    speakers = "One person"
    for i in range(len(fResponse)-15): 
        if fResponse[i:i+9] == "\"speaker\"":
            if int(fResponse[i+11]) > 0:
                speakers = "Multiple people"
    
    ## freq list of filler words
    fillerwords = ["um", "uh"] #"like"]
    fillers = {word: 0 for word in fillerwords}
    for word in transcript.lower().replace(",", "").split():
        if word in fillers:
            fillers[word] += 1
    

    genai.configure(api_key="AIzaSyD9FYuf_1KZ9t62EqzIP0Yn4D1qoMqUwqo")

    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(transcript + " The preceding text is a transcript of a person talking (or people speaking). Provide feedback directed to the person talking, specifically about the filler words that they used in the transcript. The aim of the person talking should always be to have no filler words in the transcript. While it's good to give some form of general feedback, most of the feedback given should be specific to the transcript. Also provide information about the way filler words are being used, for example, if there are a lot of filler words used in one specific part, or at the end of every sentence, comment on those facts.")
    print()
    feedback = response.text

    # filler word detection prompt for "LIKE"
    user_prompt = (
        f"The word 'like' is used in two contexts: "
        f"1) as a regular word for examples/transitions, and 2) as a filler word. "
        f"Analyze the following transcript to determine how many 'like' filler words exist ONLY in the context of a filler word, and solely output as an integer:\n\n{transcript}"
    )

    response2 = model.generate_content(user_prompt)
    print()
    feedback2 = response2.text
    print("like filler count: " + feedback2)
    fillers["like"] = feedback2

    # for "so"
    response3 = model.generate_content(transcript + " The preceding text is a transcript of a person talking (or people speaking). The word 'so' is a common filler word that is said, but it is also not a filler word in contexts where it is used as a normal transition word. Solely detect how many times this word occurs in the transcript as a FILLER word and solely output the integer.")
    print()
    feedback3 = response3.text
    print('so filler count' + feedback3)
    fillers["so"] = feedback3

    response4 = model.generate_content(transcript+ " The preceding text is a transcript of a person talking (or people speaking). The word 'and' is a common filler word that is said, but it is not always a filler word. Especially checking for the occurence of the word in the start of sentences, Solely detect how many times this word occurs in the transcript as a FILLER word and solely output the integer.")
    print()
    feedback4 = response4.text
    fillers['and'] = feedback4

    # sum the filler word counts
    total2 = 0
    for thefillerword in fillers:
        total2 += int(fillers[thefillerword])
    
    # user_prompt = (
    #     f"The word 'like' is used in two contexts: "
    #     f"1) as a regular word for examples/transitions, and 2) as a filler word. "
    #     f"In english, Analyze the following transcript to determine how many 'like' filler words exist ONLY in the context of a filler word, and surround the amount with () and respond in english:\n\n{transcript}"
    # )

    # client = Client()
    # response = client.chat.completions.create(
    #     model = "gpt-4o-mini",
    #     messages=[
    #         {"role": "system", "content": "You are an english language analysis assistant."},
    #         {"role": "user", "content": user_prompt}
    #     ],
    # )
    # responseAI = response.choices[0].message.content
    # AIfillercount = 99
    # for i in range(len(responseAI)-1):
    #     if responseAI[i:i+1] == "(":
    #         AIfillercount = responseAI[i+1:i+2]
    # fillers["like (filler)"] = AIfillercount
    # fillers["like (total)"] = fillers["like"]
    # del fillers["like"]
    # print(responseAI)

    os.remove(audio_path) 
    return jsonify({"transcript": newtranscript2, "confidence": confidence, "fillers": fillers, "speakers": speakers, "feedback": feedback, "fillercount": total2})



if __name__ == '__main__':
    os.makedirs("uploads", exist_ok=True)
    app.run(port=5000)
