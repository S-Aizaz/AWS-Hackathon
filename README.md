# AWS-Hackathon

Earth Dataset Foundry
In one line: you ask a question about the planet in plain English, and an AI agent finds the right open Earth dataset for it. Each run is recorded and scored so you can check the answer.

How a question gets answered
You type or speak something like "where is it going to rain?" The agent then works through four steps:

Search a catalog of Earth datasets (satellite imagery, weather, land cover and so on).
Details: reads the top candidate's description, format, resolution and license.
Preview: checks that the data really fits the question.
Sample: pulls a small piece of the data to confirm it can be used.
It then gives a recommendation with the dataset's location. For the rain question it picked NOAA's GFS weather forecast data, which is free and stored on AWS.

What makes it more than a chatbot
Traced: every step the agent takes is saved, so you can see how it reached its answer.
Scored: each run gets a score out of 100 for following the steps and giving a usable answer. The rain question scored 100.
Replayable: any past run can be replayed from the saved record.
Metrics: the page shows time, tokens and cost for each run. A run takes about 6 seconds and costs a fraction of a cent.
Where it runs (AWS account ai)
Piece	What it does
CloudFront	The public web address: https://d30qxjkvib20fw.cloudfront.net
S3	Stores the web page and the saved run records
Lambda	Runs the agent (Python)
Bedrock (Amazon Nova Pro)	The AI model that decides what to do at each step


