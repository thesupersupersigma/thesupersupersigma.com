## Notes for other ppl reading ##

Theres nothing much for me to put here but u can look at the notes/refrences that i use

## Notes for me ##

Priority order of tags are:
ID      #ID
CLASS   .CLASS
NAME    [name="NAME"]

<a> links require href to point to whatever which can be an external page, a local page or a specefic point on the page by using #

<img> requires src which can be something from an external source or from public

ID's in css cant start with a digit, if it does you ened to do [id="1"]

add alts/descriptions for images and stuff like that, ex:

<img src="#" alt="A field of yellow sunflowers" /> (from codeacademy, the # would prob be a link to an img of sunflowers)

When doing videos add controls attribute for basic video controls, unless not required

You can set images as links by adding an image tag in a a tag like <a><img></a>

You can do target="_blank" in an <a> tag to make it open in a new window

you can make auto scroll things by linking a <a> to  an id like this (example id being used it intro) <p><a href="#intro">Intro</a><p>

<!-- This is a comment that the browser will not display. --> for html  <!-- -->

### Table Setup ###
<table>
  <thead>                        <!-- groups header rows -->
    <tr>
      <th scope="col">Label</th> <!-- column header -->
      <th scope="col">Label</th>
      <th scope="col">Label</th>
    </tr>
  </thead>

  <tbody>                        <!-- groups main data rows -->
    <tr>
      <th scope="row">Label</th> <!-- row header (optional) -->
      <td>data</td>
      <td>data</td>
    </tr>
    <tr>
      <th scope="row">Label</th>
      <td>data</td>
      <td>data</td>
    </tr>
  </tbody>

  <tfoot>                        <!-- groups summary/total rows -->
    <tr>
      <th scope="row">Total</th>
      <td>data</td>
      <td>data</td>
    </tr>
  </tfoot>
</table>

<!-- extras -->
<!-- colspan="2" — stretch a cell across 2 columns -->
<!-- rowspan="2" — stretch a cell down 2 rows      -->
<!-- margin: 0 auto — center the table in CSS       -->